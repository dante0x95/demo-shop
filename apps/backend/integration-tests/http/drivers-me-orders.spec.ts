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

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    const createOrder = async (email = "buyer@test.com") => {
      const orderModuleService = getContainer().resolve(Modules.ORDER)
      return await orderModuleService.createOrders({
        currency_code: "usd",
        email,
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

    // Registers and activates a driver (only active drivers take orders).
    const createActiveDriver = async (email: string) => {
      const { driver, headers } = await createDriver(api, { email })
      const driverModuleService: DriverModuleService =
        getContainer().resolve(DRIVER_MODULE)
      await driverModuleService.updateDrivers({ id: driver.id, is_active: true })
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

    const markDelivered = async (orderId: string) => {
      const fulfillmentModuleService = getContainer().resolve(
        Modules.FULFILLMENT
      )
      const fulfillment = await fulfillmentModuleService.createFulfillment({
        location_id: "sloc_test",
        provider_id: "manual_manual",
        delivered_at: new Date(),
        delivery_address: {},
        items: [{ title: "Shirt", sku: "SHIRT", quantity: 2, barcode: "" }],
        labels: [],
      })
      await getContainer()
        .resolve(ContainerRegistrationKeys.LINK)
        .create({
          [Modules.ORDER]: { order_id: orderId },
          [Modules.FULFILLMENT]: { fulfillment_id: fulfillment.id },
        })
    }

    // A fulfillment that left the warehouse but was not delivered yet.
    const markShipped = async (orderId: string) => {
      const fulfillmentModuleService = getContainer().resolve(
        Modules.FULFILLMENT
      )
      const fulfillment = await fulfillmentModuleService.createFulfillment({
        location_id: "sloc_test",
        provider_id: "manual_manual",
        shipped_at: new Date(),
        delivery_address: {},
        items: [{ title: "Shirt", sku: "SHIRT", quantity: 2, barcode: "" }],
        labels: [],
      })
      await getContainer()
        .resolve(ContainerRegistrationKeys.LINK)
        .create({
          [Modules.ORDER]: { order_id: orderId },
          [Modules.FULFILLMENT]: { fulfillment_id: fulfillment.id },
        })
    }

    const getOrders = (
      path: string,
      headers?: Record<string, string>
    ) =>
      api
        .get(path, headers ? { headers } : undefined)
        .catch((e) => e.response)

    const ids = (res: { data: { orders: { id: string }[] } }) =>
      res.data.orders.map((order) => order.id)

    describe("GET /drivers/me/orders", () => {
      it("returns the driver's orders with what a delivery needs", async () => {
        const order = await createOrder()
        const { driver, headers } = await createActiveDriver("ana@test.com")
        await assignDriver(order.id, driver.id)

        const res = await getOrders("/drivers/me/orders", headers)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          orders: [expect.objectContaining({ id: order.id })],
          count: 1,
          offset: 0,
          limit: 20,
        })
        const [returned] = res.data.orders
        expect(returned).toEqual(
          expect.objectContaining({
            id: order.id,
            display_id: order.display_id,
            status: "pending",
            email: "buyer@test.com",
            currency_code: "usd",
            total: 40,
            shipping_address: expect.objectContaining({
              first_name: "Maria",
              address_1: "Av. Reforma 1",
              city: "CDMX",
              phone: "+52 55 0000 0000",
            }),
            items: [
              expect.objectContaining({ title: "Shirt", quantity: 2 }),
            ],
            fulfillments: [],
          })
        )
        expect(returned.driver).toBeUndefined()
        expect(returned.customer).toBeUndefined()
      })

      it("never shows another driver's orders", async () => {
        const [first, second, third] = [
          await createOrder(),
          await createOrder(),
          await createOrder(),
        ]
        const a = await createActiveDriver("a@test.com")
        const b = await createActiveDriver("b@test.com")
        await assignDriver(first.id, a.driver.id)
        await assignDriver(second.id, b.driver.id)
        await assignDriver(third.id, b.driver.id)

        const resA = await getOrders("/drivers/me/orders", a.headers)
        const resB = await getOrders("/drivers/me/orders", b.headers)

        expect(ids(resA)).toEqual([first.id])
        expect(resA.data.count).toBe(1)
        expect(ids(resB).sort()).toEqual([second.id, third.id].sort())
        expect(resB.data.count).toBe(2)
      })

      it("drops an order once it is reassigned to another driver", async () => {
        const order = await createOrder()
        const a = await createActiveDriver("a@test.com")
        const b = await createActiveDriver("b@test.com")
        await assignDriver(order.id, a.driver.id)
        await assignDriver(order.id, b.driver.id)

        const resA = await getOrders("/drivers/me/orders", a.headers)
        const resB = await getOrders("/drivers/me/orders", b.headers)

        expect(resA.data).toEqual(
          expect.objectContaining({ orders: [], count: 0 })
        )
        expect(ids(resB)).toEqual([order.id])
      })

      it("returns an empty page when the driver has no orders", async () => {
        await createOrder()
        const { headers } = await createActiveDriver("ana@test.com")

        const res = await getOrders("/drivers/me/orders", headers)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({ orders: [], count: 0, offset: 0, limit: 20 })
      })

      it("still lists the orders of a driver deactivated after assignment", async () => {
        const order = await createOrder()
        const { driver, headers } = await createActiveDriver("ana@test.com")
        await assignDriver(order.id, driver.id)
        const driverModuleService: DriverModuleService =
          getContainer().resolve(DRIVER_MODULE)
        await driverModuleService.updateDrivers({
          id: driver.id,
          is_active: false,
        })

        const res = await getOrders("/drivers/me/orders", headers)

        expect(res.status).toBe(200)
        expect(ids(res)).toEqual([order.id])
      })

      it("filters by delivery status", async () => {
        const [pending, shipped, delivered] = [
          await createOrder(),
          await createOrder(),
          await createOrder(),
        ]
        const { driver, headers } = await createActiveDriver("ana@test.com")
        for (const order of [pending, shipped, delivered]) {
          await assignDriver(order.id, driver.id)
        }
        await markShipped(shipped.id)
        await markDelivered(delivered.id)

        const deliveredRes = await getOrders(
          "/drivers/me/orders?delivery_status=delivered",
          headers
        )
        const pendingRes = await getOrders(
          "/drivers/me/orders?delivery_status=pending",
          headers
        )
        const allRes = await getOrders("/drivers/me/orders", headers)

        expect(deliveredRes.status).toBe(200)
        expect(ids(deliveredRes)).toEqual([delivered.id])
        expect(deliveredRes.data.count).toBe(1)
        expect(deliveredRes.data.orders[0].fulfillments).toEqual([
          expect.objectContaining({ delivered_at: expect.any(String) }),
        ])

        expect(pendingRes.status).toBe(200)
        expect(ids(pendingRes).sort()).toEqual([pending.id, shipped.id].sort())
        expect(pendingRes.data.count).toBe(2)

        expect(allRes.data.count).toBe(3)
      })

      it("does not count another driver's delivered orders", async () => {
        const [mine, theirs] = [await createOrder(), await createOrder()]
        const a = await createActiveDriver("a@test.com")
        const b = await createActiveDriver("b@test.com")
        await assignDriver(mine.id, a.driver.id)
        await assignDriver(theirs.id, b.driver.id)
        await markDelivered(theirs.id)

        const res = await getOrders(
          "/drivers/me/orders?delivery_status=delivered",
          a.headers
        )

        expect(res.status).toBe(200)
        expect(res.data).toEqual(
          expect.objectContaining({ orders: [], count: 0 })
        )
      })

      it("paginates newest first", async () => {
        const { driver, headers } = await createActiveDriver("ana@test.com")
        const created: string[] = []
        for (let i = 0; i < 3; i++) {
          const order = await createOrder()
          await assignDriver(order.id, driver.id)
          created.push(order.id)
        }
        const newestFirst = [...created].reverse()

        const firstPage = await getOrders(
          "/drivers/me/orders?limit=2",
          headers
        )
        const secondPage = await getOrders(
          "/drivers/me/orders?limit=2&offset=2",
          headers
        )

        expect(firstPage.status).toBe(200)
        expect(firstPage.data).toEqual(
          expect.objectContaining({ count: 3, offset: 0, limit: 2 })
        )
        expect(ids(firstPage)).toEqual(newestFirst.slice(0, 2))
        expect(secondPage.data).toEqual(
          expect.objectContaining({ count: 3, offset: 2, limit: 2 })
        )
        expect(ids(secondPage)).toEqual(newestFirst.slice(2))
      })

      it("orders by an allowed field", async () => {
        const { driver, headers } = await createActiveDriver("ana@test.com")
        const created: string[] = []
        for (let i = 0; i < 2; i++) {
          const order = await createOrder()
          await assignDriver(order.id, driver.id)
          created.push(order.id)
        }

        const res = await getOrders(
          "/drivers/me/orders?order=display_id",
          headers
        )

        expect(res.status).toBe(200)
        expect(ids(res)).toEqual(created)
      })

      it("returns only the requested fields", async () => {
        const order = await createOrder()
        const { driver, headers } = await createActiveDriver("ana@test.com")
        await assignDriver(order.id, driver.id)

        const res = await getOrders(
          "/drivers/me/orders?fields=id,status",
          headers
        )

        expect(res.status).toBe(200)
        expect(res.data.orders).toEqual([{ id: order.id, status: "pending" }])
      })

      it("drops fields outside the allow-list", async () => {
        const order = await createOrder()
        const { driver, headers } = await createActiveDriver("ana@test.com")
        await assignDriver(order.id, driver.id)

        const res = await getOrders(
          "/drivers/me/orders?fields=id,driver.email,customer.*,+payment_collections.*",
          headers
        )

        expect(res.status).toBe(200)
        expect(res.data.orders).toEqual([{ id: order.id }])
      })

      it("returns 400 when ordering by a field outside the allow-list", async () => {
        const { headers } = await createActiveDriver("ana@test.com")

        const res = await getOrders(
          "/drivers/me/orders?order=customer_id",
          headers
        )

        expect(res.status).toBe(400)
      })

      it("returns 400 for an unknown delivery status", async () => {
        const { headers } = await createActiveDriver("ana@test.com")

        const res = await getOrders(
          "/drivers/me/orders?delivery_status=shipped",
          headers
        )

        expect(res.status).toBe(400)
      })

      it.each([
        ["an unknown param", "driver_id=drv_other"],
        ["with_deleted", "with_deleted=true"],
        ["a non-numeric limit", "limit=many"],
      ])("returns 400 for %s", async (_, params) => {
        const { headers } = await createActiveDriver("ana@test.com")

        const res = await getOrders(`/drivers/me/orders?${params}`, headers)

        expect(res.status).toBe(400)
      })

      it("returns 404 when the driver no longer exists", async () => {
        const order = await createOrder()
        const { driver, headers } = await createActiveDriver("ana@test.com")
        await assignDriver(order.id, driver.id)
        const driverModuleService: DriverModuleService =
          getContainer().resolve(DRIVER_MODULE)
        await driverModuleService.softDeleteDrivers(driver.id)

        const res = await getOrders("/drivers/me/orders", headers)

        expect(res.status).toBe(404)
        expect(res.data.message).toBe("Driver not found")
      })

      it("returns 401 without a token", async () => {
        const res = await getOrders("/drivers/me/orders")

        expect(res.status).toBe(401)
      })

      it("returns 401 with an admin token", async () => {
        const res = await getOrders("/drivers/me/orders", adminHeaders.headers)

        expect(res.status).toBe(401)
      })

      it("returns 401 with a registration token that has no driver yet", async () => {
        const token = await registerDriverIdentity(api)

        const res = await getOrders("/drivers/me/orders", bearer(token).headers)

        expect(res.status).toBe(401)
      })
    })
  },
})
