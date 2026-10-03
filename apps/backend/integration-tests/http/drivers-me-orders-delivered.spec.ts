import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DRIVER_MODULE } from "../../src/modules/driver"
import DriverModuleService from "../../src/modules/driver/service"
import { createAdminUser } from "../helpers/admin-auth"
import {
  bearer,
  createDriver,
  registerDriverIdentity,
} from "../helpers/driver-auth"

jest.setTimeout(60 * 1000)

type FulfillmentState = {
  shipped?: boolean
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

    // Registers and activates a driver (only active drivers take orders).
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

    // What core's create-order-fulfillment flow leaves behind: a fulfillment
    // for the order's items, linked to the order and registered on it (so the
    // items have a fulfilled quantity to deliver).
    const createFulfillment = async (
      order: { id: string; items?: { id: string; quantity: unknown }[] | null },
      { shipped, delivered, canceled }: FulfillmentState = {}
    ) => {
      const container = getContainer()
      const [item] = order.items!
      const quantity = Number(item.quantity)
      const fulfillment = await container
        .resolve(Modules.FULFILLMENT)
        .createFulfillment({
          location_id: "sloc_test",
          provider_id: "manual_manual",
          shipped_at: shipped ? new Date() : null,
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
      if (!canceled) {
        await container.resolve(Modules.ORDER).registerFulfillment({
          order_id: order.id,
          reference: Modules.FULFILLMENT,
          reference_id: fulfillment.id,
          items: [{ id: item.id, quantity }],
        })
      }
      return fulfillment
    }

    // An order of one item (2 units), assigned to a new active driver.
    const setup = async (email = "ana@test.com") => {
      const order = await createOrder()
      const { driver, headers } = await createActiveDriver(email)
      await assignDriver(order.id, driver.id)
      return { order, driver, headers }
    }

    const confirm = (
      orderId: string,
      headers?: Record<string, string>,
      body: Record<string, unknown> = {},
      queryString = ""
    ) =>
      api
        .post(
          `/drivers/me/orders/${orderId}/delivered${queryString}`,
          body,
          headers ? { headers } : undefined
        )
        .catch((e) => e.response)

    const getFulfillment = (id: string) =>
      getContainer()
        .resolve(Modules.FULFILLMENT)
        .retrieveFulfillment(id, { select: ["id", "delivered_at"] })

    const getDeliveredQuantity = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["items.detail.delivered_quantity"],
          filters: { id: orderId },
        })
      return Number(data[0].items?.[0]?.detail?.delivered_quantity ?? 0)
    }

    const getDriverId = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["driver.id"],
          filters: { id: orderId },
        })
      return data[0].driver?.id
    }

    describe("POST /drivers/me/orders/:id/delivered", () => {
      it("marks the order's fulfillment as delivered", async () => {
        const { order, headers } = await setup()
        const fulfillment = await createFulfillment(order, { shipped: true })

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(200)
        expect(res.data.order).toEqual(
          expect.objectContaining({
            id: order.id,
            display_id: order.display_id,
            status: "pending",
            fulfillments: [
              expect.objectContaining({
                id: fulfillment.id,
                delivered_at: expect.any(String),
              }),
            ],
          })
        )
        expect(res.data.order.driver).toBeUndefined()
        expect(res.data.order.customer).toBeUndefined()
        expect((await getFulfillment(fulfillment.id)).delivered_at).toBeTruthy()
        // The core flow registered the delivery on the order items too.
        expect(await getDeliveredQuantity(order.id)).toBe(2)

        const list = await api.get(
          "/drivers/me/orders?delivery_status=delivered",
          { headers }
        )
        expect(list.data.orders.map((o: { id: string }) => o.id)).toEqual([
          order.id,
        ])
      })

      it("delivers a fulfillment that was never marked shipped", async () => {
        const { order, headers } = await setup()
        const fulfillment = await createFulfillment(order)

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(200)
        expect((await getFulfillment(fulfillment.id)).delivered_at).toBeTruthy()
      })

      it("is idempotent: confirming again changes nothing", async () => {
        const { order, headers } = await setup()
        const fulfillment = await createFulfillment(order, { shipped: true })

        const first = await confirm(order.id, headers)
        const deliveredAt = (await getFulfillment(fulfillment.id)).delivered_at
        const second = await confirm(order.id, headers)

        expect(first.status).toBe(200)
        expect(second.status).toBe(200)
        expect(second.data.order.fulfillments[0].delivered_at).toEqual(
          first.data.order.fulfillments[0].delivered_at
        )
        expect((await getFulfillment(fulfillment.id)).delivered_at).toEqual(
          deliveredAt
        )
        expect(await getDeliveredQuantity(order.id)).toBe(2)
      })

      it("delivers only once when two confirmations race", async () => {
        const { order, headers } = await setup()
        await createFulfillment(order, { shipped: true })

        const results = await Promise.all([
          confirm(order.id, headers),
          confirm(order.id, headers),
        ])

        expect(results.map((res) => res.status)).toEqual([200, 200])
        expect(await getDeliveredQuantity(order.id)).toBe(2)
      })

      // A confirmation holds the order lock from its ownership check to the
      // delivery, so a reassignment can't slip in between.
      it("makes a reassignment wait for a confirmation in progress", async () => {
        const { order, driver, headers } = await setup("a@test.com")
        await createFulfillment(order, { shipped: true })
        const b = await createActiveDriver("b@test.com")
        const locking = getContainer().resolve(Modules.LOCKING)

        // Stands in for a confirmation that already passed its ownership check.
        await locking.acquire(order.id, { expire: 10 })
        const reassign = api
          .post(
            `/admin/orders/${order.id}/assign-driver`,
            { driver_id: b.driver.id },
            adminHeaders
          )
          .catch((e) => e.response)
        await new Promise((resolve) => setTimeout(resolve, 700))
        expect(await getDriverId(order.id)).toBe(driver.id)
        await locking.release(order.id)

        expect((await reassign).status).toBe(200)
        expect(await getDriverId(order.id)).toBe(b.driver.id)
        expect((await confirm(order.id, headers)).status).toBe(404)
        expect(await getDeliveredQuantity(order.id)).toBe(0)
      })

      it("never delivers for a driver who lost the order in a race", async () => {
        const { order, driver, headers } = await setup("a@test.com")
        await createFulfillment(order, { shipped: true })
        const b = await createActiveDriver("b@test.com")

        const [delivered, reassigned] = await Promise.all([
          confirm(order.id, headers),
          api
            .post(
              `/admin/orders/${order.id}/assign-driver`,
              { driver_id: b.driver.id },
              adminHeaders
            )
            .catch((e) => e.response),
        ])

        // Whichever runs first wins; the other sees its result.
        const driverId = await getDriverId(order.id)
        const quantity = await getDeliveredQuantity(order.id)
        if (delivered.status === 200) {
          expect(reassigned.status).toBe(400)
          expect(driverId).toBe(driver.id)
          expect(quantity).toBe(2)
        } else {
          expect(delivered.status).toBe(404)
          expect(reassigned.status).toBe(200)
          expect(driverId).toBe(b.driver.id)
          expect(quantity).toBe(0)
        }
      })

      it("returns 200 for an order an admin already marked delivered", async () => {
        const { order, headers } = await setup()
        const fulfillment = await createFulfillment(order, {
          shipped: true,
          delivered: true,
        })

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(200)
        expect(res.data.order.fulfillments).toEqual([
          expect.objectContaining({
            id: fulfillment.id,
            delivered_at: expect.any(String),
          }),
        ])
      })

      it("skips canceled fulfillments when picking the one to deliver", async () => {
        const { order, headers } = await setup()
        const canceled = await createFulfillment(order, { canceled: true })
        const active = await createFulfillment(order, { shipped: true })

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(200)
        expect((await getFulfillment(active.id)).delivered_at).toBeTruthy()
        expect((await getFulfillment(canceled.id)).delivered_at).toBeNull()
      })

      it("delivers the fulfillment named by fulfillment_id", async () => {
        const { order, headers } = await setup()
        // Two fulfillments of one unit each.
        const [item] = order.items!
        const half = { ...order, items: [{ id: item.id, quantity: 1 }] }
        const first = await createFulfillment(half, { shipped: true })
        const second = await createFulfillment(half, { shipped: true })

        const res = await confirm(order.id, headers, {
          fulfillment_id: second.id,
        })

        expect(res.status).toBe(200)
        expect((await getFulfillment(second.id)).delivered_at).toBeTruthy()
        expect((await getFulfillment(first.id)).delivered_at).toBeNull()
        expect(await getDeliveredQuantity(order.id)).toBe(1)

        // With one left pending, no fulfillment_id is needed.
        const rest = await confirm(order.id, headers)
        expect(rest.status).toBe(200)
        expect((await getFulfillment(first.id)).delivered_at).toBeTruthy()
        expect(await getDeliveredQuantity(order.id)).toBe(2)
      })

      it("returns 403 for a driver deactivated after assignment, and 200 once reactivated", async () => {
        const { order, driver, headers } = await setup()
        const fulfillment = await createFulfillment(order, { shipped: true })
        await setDriverActive(driver.id, false)

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(403)
        expect(res.data.message).toBe("Driver is inactive")
        expect((await getFulfillment(fulfillment.id)).delivered_at).toBeNull()
        expect(await getDeliveredQuantity(order.id)).toBe(0)
        // The order stays assigned to them.
        expect(await getDriverId(order.id)).toBe(driver.id)

        await setDriverActive(driver.id, true)

        const reactivated = await confirm(order.id, headers)

        expect(reactivated.status).toBe(200)
        expect((await getFulfillment(fulfillment.id)).delivered_at).toBeTruthy()
        expect(await getDeliveredQuantity(order.id)).toBe(2)
      })

      it("returns 403 to an inactive driver even with a fulfillment_id", async () => {
        const { order, driver, headers } = await setup()
        const fulfillment = await createFulfillment(order, { shipped: true })
        await setDriverActive(driver.id, false)

        const res = await confirm(order.id, headers, {
          fulfillment_id: fulfillment.id,
        })

        expect(res.status).toBe(403)
        expect((await getFulfillment(fulfillment.id)).delivered_at).toBeNull()
      })

      it("returns 403 to an inactive driver for an already delivered order", async () => {
        const { order, driver, headers } = await setup()
        await createFulfillment(order, { shipped: true })
        expect((await confirm(order.id, headers)).status).toBe(200)
        await setDriverActive(driver.id, false)

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(403)
        expect(res.data.message).toBe("Driver is inactive")
      })

      // The inactive check runs before the ownership check, so an inactive
      // driver can't use the 403/404 difference to probe order ids.
      it("returns 403 to an inactive driver for any order id", async () => {
        const { order } = await setup("a@test.com")
        await createFulfillment(order, { shipped: true })
        const other = await createActiveDriver("b@test.com")
        await setDriverActive(other.driver.id, false)

        const foreign = await confirm(order.id, other.headers)
        const unknown = await confirm("order_unknown", other.headers)

        expect(foreign.status).toBe(403)
        expect(unknown.status).toBe(403)
        expect(await getDeliveredQuantity(order.id)).toBe(0)
      })

      it("narrows the response with fields", async () => {
        const { order, headers } = await setup()
        await createFulfillment(order, { shipped: true })

        const res = await confirm(
          order.id,
          headers,
          {},
          "?fields=id,fulfillments.delivered_at"
        )

        expect(res.status).toBe(200)
        expect(res.data.order.id).toBe(order.id)
        expect(res.data.order.fulfillments[0].delivered_at).toEqual(
          expect.any(String)
        )
        expect(res.data.order.email).toBeUndefined()
      })

      it("returns 400 when the order has no fulfillment", async () => {
        const { order, headers } = await setup()

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("has no fulfillment to deliver")
      })

      it("returns 400 when every fulfillment is canceled", async () => {
        const { order, headers } = await setup()
        await createFulfillment(order, { canceled: true })

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("has no fulfillment to deliver")
      })

      it("returns 400 when several fulfillments are pending and none is named", async () => {
        const { order, headers } = await setup()
        const [item] = order.items!
        const half = { ...order, items: [{ id: item.id, quantity: 1 }] }
        const first = await createFulfillment(half, { shipped: true })
        const second = await createFulfillment(half, { shipped: true })

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("send fulfillment_id")
        expect((await getFulfillment(first.id)).delivered_at).toBeNull()
        expect((await getFulfillment(second.id)).delivered_at).toBeNull()
      })

      it("returns 400 when fulfillment_id belongs to another order", async () => {
        const { order, headers } = await setup()
        await createFulfillment(order, { shipped: true })
        const other = await createOrder()
        const otherFulfillment = await createFulfillment(other, {
          shipped: true,
        })

        const res = await confirm(order.id, headers, {
          fulfillment_id: otherFulfillment.id,
        })

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("is not part of order")
        expect(
          (await getFulfillment(otherFulfillment.id)).delivered_at
        ).toBeNull()
      })

      it("returns 400 when fulfillment_id is canceled", async () => {
        const { order, headers } = await setup()
        const canceled = await createFulfillment(order, { canceled: true })

        const res = await confirm(order.id, headers, {
          fulfillment_id: canceled.id,
        })

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("is canceled")
      })

      it("returns 400 for a canceled order", async () => {
        const { order, headers } = await setup()
        const fulfillment = await createFulfillment(order, { shipped: true })
        await getContainer().resolve(Modules.ORDER).cancel(order.id)

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("is canceled")
        expect((await getFulfillment(fulfillment.id)).delivered_at).toBeNull()
      })

      it.each([
        ["an unknown field", { delivered: true }],
        ["an empty fulfillment_id", { fulfillment_id: "" }],
        ["a non-string fulfillment_id", { fulfillment_id: 1 }],
      ])("returns 400 for %s in the body", async (_, body) => {
        const { order, headers } = await setup()
        await createFulfillment(order, { shipped: true })

        const res = await confirm(order.id, headers, body)

        expect(res.status).toBe(400)
        expect(await getDeliveredQuantity(order.id)).toBe(0)
      })

      it("returns 400 for an unknown query param", async () => {
        const { order, headers } = await setup()
        await createFulfillment(order, { shipped: true })

        const res = await confirm(order.id, headers, {}, "?driver_id=x")

        expect(res.status).toBe(400)
        expect(await getDeliveredQuantity(order.id)).toBe(0)
      })

      it("returns 404 for an unknown order", async () => {
        const { headers } = await setup()

        const res = await confirm("order_unknown", headers)

        expect(res.status).toBe(404)
        expect(res.data.message).toBe(
          "Order with id: order_unknown was not found"
        )
      })

      it("returns 404 for another driver's order, like an unknown one", async () => {
        const { order } = await setup("a@test.com")
        const fulfillment = await createFulfillment(order, { shipped: true })
        const other = await createActiveDriver("b@test.com")

        const res = await confirm(order.id, other.headers)

        expect(res.status).toBe(404)
        expect(res.data.message).toBe(
          `Order with id: ${order.id} was not found`
        )
        expect((await getFulfillment(fulfillment.id)).delivered_at).toBeNull()
      })

      it("returns 404 for an order without a driver", async () => {
        const order = await createOrder()
        await createFulfillment(order, { shipped: true })
        const { headers } = await createActiveDriver("ana@test.com")

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(404)
        expect(await getDeliveredQuantity(order.id)).toBe(0)
      })

      it("returns 404 to the previous driver once the order is reassigned", async () => {
        const { order, headers } = await setup("a@test.com")
        await createFulfillment(order, { shipped: true })
        const b = await createActiveDriver("b@test.com")
        await assignDriver(order.id, b.driver.id)

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(404)
        expect(await getDeliveredQuantity(order.id)).toBe(0)
      })

      it("returns 404 when the driver no longer exists", async () => {
        const { order, driver, headers } = await setup()
        await createFulfillment(order, { shipped: true })
        const driverModuleService: DriverModuleService =
          getContainer().resolve(DRIVER_MODULE)
        await driverModuleService.softDeleteDrivers(driver.id)

        const res = await confirm(order.id, headers)

        expect(res.status).toBe(404)
        expect(res.data.message).toBe("Driver not found")
        expect(await getDeliveredQuantity(order.id)).toBe(0)
      })

      it("returns 401 without a token", async () => {
        const { order } = await setup()

        const res = await confirm(order.id)

        expect(res.status).toBe(401)
      })

      it("returns 401 with an admin token", async () => {
        const { order } = await setup()

        const res = await confirm(order.id, adminHeaders.headers)

        expect(res.status).toBe(401)
      })

      it("returns 401 with a registration token that has no driver yet", async () => {
        const { order } = await setup()
        const token = await registerDriverIdentity(api, {
          email: "new@test.com",
        })

        const res = await confirm(order.id, bearer(token).headers)

        expect(res.status).toBe(401)
      })
    })
  },
})
