import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { DRIVER_MODULE } from "../../src/modules/driver"
import DriverModuleService from "../../src/modules/driver/service"
import { createAdminUser } from "../helpers/admin-auth"
import {
  bearer,
  createDriver,
  registerDriverIdentity,
} from "../helpers/driver-auth"

jest.setTimeout(60 * 1000)

const CASH_PROVIDER_ID = "pp_system_default"

type FulfillmentState = {
  delivered?: boolean
  canceled?: boolean
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    // One item, 2 units of 20: total 40.
    const createOrder = async () => {
      const orderModuleService = getContainer().resolve(Modules.ORDER)
      return await orderModuleService.createOrders({
        currency_code: "usd",
        email: "buyer@test.com",
        shipping_address: {
          first_name: "Maria",
          last_name: "Perez",
          phone: "+52 55 0000 0000",
          address_1: "Av. Reforma 1",
          city: "CDMX",
          postal_code: "06600",
          country_code: "mx",
        },
        items: [{ title: "Shirt", quantity: 2, unit_price: 20 }],
      })
    }

    const setDriverActive = async (driverId: string, isActive: boolean) => {
      const driverModuleService: DriverModuleService =
        getContainer().resolve(DRIVER_MODULE)
      await driverModuleService.updateDrivers({
        id: driverId,
        is_active: isActive,
      })
    }

    const createActiveDriver = async (email: string) => {
      const { driver, headers } = await createDriver(api, { email })
      await setDriverActive(driver.id, true)
      return { driver, headers }
    }

    const assignDriver = async (orderId: string, driverId: string) => {
      const res = await api.post(
        `/admin/orders/${orderId}/assign-driver`,
        { driver_id: driverId },
        adminHeaders
      )
      expect(res.status).toBe(200)
    }

    // What checkout leaves behind for cash on delivery: a payment collection
    // linked to the order, with an authorized (not captured) manual payment.
    const createCashPayment = async (orderId: string, amount = 40) => {
      const container = getContainer()
      const paymentModuleService = container.resolve(Modules.PAYMENT)
      const collection = await paymentModuleService.createPaymentCollections({
        currency_code: "usd",
        amount,
      })
      await container.resolve(ContainerRegistrationKeys.LINK).create({
        [Modules.ORDER]: { order_id: orderId },
        [Modules.PAYMENT]: { payment_collection_id: collection.id },
      })
      const session = await paymentModuleService.createPaymentSession(
        collection.id,
        {
          provider_id: CASH_PROVIDER_ID,
          currency_code: "usd",
          amount,
          data: {},
        }
      )
      return await paymentModuleService.authorizePaymentSession(session.id, {})
    }

    const createFulfillment = async (
      order: { id: string; items?: { id: string; quantity: unknown }[] | null },
      { delivered, canceled }: FulfillmentState = {}
    ) => {
      const container = getContainer()
      const [item] = order.items!
      const quantity = Number(item.quantity)
      const fulfillment = await container
        .resolve(Modules.FULFILLMENT)
        .createFulfillment({
          location_id: "sloc_test",
          provider_id: "manual_manual",
          shipped_at: new Date(),
          delivered_at: delivered ? new Date() : null,
          canceled_at: canceled ? new Date() : null,
          delivery_address: {},
          items: [
            {
              title: "Shirt",
              sku: "SHIRT",
              quantity,
              barcode: "",
              line_item_id: item.id,
            },
          ],
          labels: [],
        })
      await container.resolve(ContainerRegistrationKeys.LINK).create({
        [Modules.ORDER]: { order_id: order.id },
        [Modules.FULFILLMENT]: { fulfillment_id: fulfillment.id },
      })
      return fulfillment
    }

    // An order with a cash payment, assigned to a new active driver.
    const setup = async (email = "ana@test.com") => {
      const order = await createOrder()
      const payment = await createCashPayment(order.id)
      const { driver, headers } = await createActiveDriver(email)
      await assignDriver(order.id, driver.id)
      return { order, payment, driver, headers }
    }

    // Same, already delivered: the state in which the driver collects.
    const setupDelivered = async (email = "ana@test.com") => {
      const ctx = await setup(email)
      await createFulfillment(ctx.order, { delivered: true })
      return ctx
    }

    const collect = (
      orderId: string,
      headers?: Record<string, string>,
      body: Record<string, unknown> = {},
      queryString = ""
    ) =>
      api
        .post(
          `/drivers/me/orders/${orderId}/collect-payment${queryString}`,
          body,
          headers ? { headers } : undefined
        )
        .catch((e) => e.response)

    const getPayment = (id: string) =>
      getContainer()
        .resolve(Modules.PAYMENT)
        .retrievePayment(id, {
          select: ["id", "captured_at"],
          relations: ["captures"],
        })

    const getOrderTransactions = (orderId: string) =>
      getContainer()
        .resolve(Modules.ORDER)
        .listOrderTransactions({ order_id: orderId })

    describe("POST /drivers/me/orders/:id/collect-payment", () => {
      it("captures the order's cash payment once it is delivered", async () => {
        const { order, payment, driver, headers } = await setupDelivered()

        const res = await collect(order.id, headers)

        expect(res.status).toBe(200)
        expect(res.data.order).toEqual(
          expect.objectContaining({
            id: order.id,
            display_id: order.display_id,
            total: 40,
            fulfillments: [
              expect.objectContaining({ delivered_at: expect.any(String) }),
            ],
          })
        )
        expect(res.data.order.payment_collections).toBeUndefined()
        expect(res.data.order.driver).toBeUndefined()
        expect(res.data.payment).toEqual({
          id: payment.id,
          amount: 40,
          currency_code: "usd",
          captured_at: expect.any(String),
        })

        const stored = await getPayment(payment.id)
        expect(stored.captured_at).toBeTruthy()
        expect(stored.captures).toHaveLength(1)
        expect(stored.captures![0]).toEqual(
          expect.objectContaining({ created_by: driver.id })
        )
        // The capture is recorded on the order, so its paid total is up to date.
        const transactions = await getOrderTransactions(order.id)
        expect(transactions).toHaveLength(1)
        expect(transactions[0]).toEqual(
          expect.objectContaining({ amount: 40, reference: "capture" })
        )
      })

      it("returns 409 when the payment was already collected", async () => {
        const { order, payment, headers } = await setupDelivered()
        expect((await collect(order.id, headers)).status).toBe(200)

        const res = await collect(order.id, headers)

        expect(res.status).toBe(409)
        expect(res.data.message).toBe(
          `The payment of order with id: ${order.id} was already collected`
        )
        expect((await getPayment(payment.id)).captures).toHaveLength(1)
        expect(await getOrderTransactions(order.id)).toHaveLength(1)
      })

      it("captures only once when two collections race", async () => {
        const { order, payment, headers } = await setupDelivered()

        const results = await Promise.all([
          collect(order.id, headers),
          collect(order.id, headers),
        ])

        expect(results.map((res) => res.status).sort()).toEqual([200, 409])
        expect((await getPayment(payment.id)).captures).toHaveLength(1)
        expect(await getOrderTransactions(order.id)).toHaveLength(1)
      })

      it("returns 409 when an admin already captured the payment", async () => {
        const { order, payment, headers } = await setupDelivered()
        await capturePaymentWorkflow(getContainer()).run({
          input: { payment_id: payment.id },
        })

        const res = await collect(order.id, headers)

        expect(res.status).toBe(409)
        expect((await getPayment(payment.id)).captures).toHaveLength(1)
      })

      it("ignores canceled fulfillments when checking the delivery", async () => {
        const { order, payment, headers } = await setup()
        await createFulfillment(order, { canceled: true })
        await createFulfillment(order, { delivered: true })

        const res = await collect(order.id, headers)

        expect(res.status).toBe(200)
        expect((await getPayment(payment.id)).captured_at).toBeTruthy()
      })

      it("narrows the order in the response with fields", async () => {
        const { order, headers } = await setupDelivered()

        const res = await collect(order.id, headers, {}, "?fields=id,total")

        expect(res.status).toBe(200)
        expect(res.data.order).toEqual({ id: order.id, total: 40 })
        expect(res.data.payment.captured_at).toEqual(expect.any(String))
      })

      it("returns 400 when the order is not delivered yet", async () => {
        const { order, payment, headers } = await setup()
        await createFulfillment(order)

        const res = await collect(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          `Order with id: ${order.id} is not delivered yet`
        )
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 400 when the order has no fulfillment", async () => {
        const { order, payment, headers } = await setup()

        const res = await collect(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("is not delivered yet")
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 400 when only some fulfillments are delivered", async () => {
        const { order, payment, headers } = await setup()
        const [item] = order.items!
        const half = { ...order, items: [{ id: item.id, quantity: 1 }] }
        await createFulfillment(half, { delivered: true })
        await createFulfillment(half)

        const res = await collect(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("is not delivered yet")
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 400 when every fulfillment is canceled", async () => {
        const { order, headers } = await setup()
        await createFulfillment(order, { canceled: true })

        const res = await collect(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("is not delivered yet")
      })

      it("returns 400 for a canceled order", async () => {
        const { order, payment, headers } = await setupDelivered()
        await getContainer().resolve(Modules.ORDER).cancel(order.id)

        const res = await collect(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(`Order with id: ${order.id} is canceled`)
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 400 when the order has no payment", async () => {
        const order = await createOrder()
        const { driver, headers } = await createActiveDriver("ana@test.com")
        await assignDriver(order.id, driver.id)
        await createFulfillment(order, { delivered: true })

        const res = await collect(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          `Order with id: ${order.id} has no cash on delivery payment to collect`
        )
      })

      it("returns 400 when the payment is not cash on delivery", async () => {
        const { order, payment, headers } = await setupDelivered()
        // The test app only registers the manual provider, so the payment is
        // moved to a card provider's id by hand.
        const pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION)
        await pg("payment")
          .where({ id: payment.id })
          .update({ provider_id: "pp_stripe_stripe" })

        const res = await collect(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain(
          "has no cash on delivery payment to collect"
        )
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 400 when the payment is canceled", async () => {
        const { order, payment, headers } = await setupDelivered()
        await getContainer().resolve(Modules.PAYMENT).cancelPayment(payment.id)

        const res = await collect(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain(
          "has no cash on delivery payment to collect"
        )
      })

      it("returns 400 when several cash payments are pending", async () => {
        const { order, payment, headers } = await setupDelivered()
        const second = await createCashPayment(order.id, 10)

        const res = await collect(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain(
          "has 2 cash on delivery payments to collect"
        )
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
        expect((await getPayment(second.id)).captures).toHaveLength(0)
      })

      it("returns 403 for a driver deactivated after assignment, and 200 once reactivated", async () => {
        const { order, payment, driver, headers } = await setupDelivered()
        await setDriverActive(driver.id, false)

        const res = await collect(order.id, headers)

        expect(res.status).toBe(403)
        expect(res.data.message).toBe("Driver is inactive")
        expect((await getPayment(payment.id)).captures).toHaveLength(0)

        await setDriverActive(driver.id, true)

        const reactivated = await collect(order.id, headers)

        expect(reactivated.status).toBe(200)
        expect((await getPayment(payment.id)).captured_at).toBeTruthy()
      })

      it("returns 403 to an inactive driver for an already collected order", async () => {
        const { order, driver, headers } = await setupDelivered()
        expect((await collect(order.id, headers)).status).toBe(200)
        await setDriverActive(driver.id, false)

        const res = await collect(order.id, headers)

        expect(res.status).toBe(403)
        expect(res.data.message).toBe("Driver is inactive")
      })

      // The inactive check runs before the ownership check, so an inactive
      // driver can't use the 403/404 difference to probe order ids.
      it("returns 403 to an inactive driver for any order id", async () => {
        const { order, payment } = await setupDelivered("a@test.com")
        const other = await createActiveDriver("b@test.com")
        await setDriverActive(other.driver.id, false)

        const foreign = await collect(order.id, other.headers)
        const unknown = await collect("order_unknown", other.headers)

        expect(foreign.status).toBe(403)
        expect(unknown.status).toBe(403)
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 400 for an unknown field in the body", async () => {
        const { order, payment, headers } = await setupDelivered()

        const res = await collect(order.id, headers, { amount: 40 })

        expect(res.status).toBe(400)
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 400 for an unknown query param", async () => {
        const { order, payment, headers } = await setupDelivered()

        const res = await collect(order.id, headers, {}, "?driver_id=x")

        expect(res.status).toBe(400)
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 404 for an unknown order", async () => {
        const { headers } = await setup()

        const res = await collect("order_unknown", headers)

        expect(res.status).toBe(404)
        expect(res.data.message).toBe(
          "Order with id: order_unknown was not found"
        )
      })

      it("returns 404 for another driver's order, like an unknown one", async () => {
        const { order, payment } = await setupDelivered("a@test.com")
        const other = await createActiveDriver("b@test.com")

        const res = await collect(order.id, other.headers)

        expect(res.status).toBe(404)
        expect(res.data.message).toBe(
          `Order with id: ${order.id} was not found`
        )
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 404 for an order without a driver", async () => {
        const order = await createOrder()
        const payment = await createCashPayment(order.id)
        await createFulfillment(order, { delivered: true })
        const { headers } = await createActiveDriver("ana@test.com")

        const res = await collect(order.id, headers)

        expect(res.status).toBe(404)
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 404 when the driver no longer exists", async () => {
        const { order, payment, driver, headers } = await setupDelivered()
        const driverModuleService: DriverModuleService =
          getContainer().resolve(DRIVER_MODULE)
        await driverModuleService.softDeleteDrivers(driver.id)

        const res = await collect(order.id, headers)

        expect(res.status).toBe(404)
        expect(res.data.message).toBe("Driver not found")
        expect((await getPayment(payment.id)).captures).toHaveLength(0)
      })

      it("returns 401 without a token", async () => {
        const { order } = await setupDelivered()

        const res = await collect(order.id)

        expect(res.status).toBe(401)
      })

      it("returns 401 with an admin token", async () => {
        const { order } = await setupDelivered()

        const res = await collect(order.id, adminHeaders.headers)

        expect(res.status).toBe(401)
      })

      it("returns 401 with a registration token that has no driver yet", async () => {
        const { order } = await setupDelivered()
        const token = await registerDriverIdentity(api, {
          email: "new@test.com",
        })

        const res = await collect(order.id, bearer(token).headers)

        expect(res.status).toBe(401)
      })
    })
  },
})
