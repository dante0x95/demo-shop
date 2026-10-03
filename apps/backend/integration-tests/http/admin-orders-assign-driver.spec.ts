import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import orderDriverUniqueOrder, {
  ORDER_DRIVER_UNIQUE_ORDER_INDEX,
} from "../../src/migration-scripts/order-driver-unique-order"
import { DRIVER_MODULE } from "../../src/modules/driver"
import DriverModuleService from "../../src/modules/driver/service"
import { createAdminUser } from "../helpers/admin-auth"
import { createDriver } from "../helpers/driver-auth"

jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    const createOrder = async (status = "pending") => {
      const orderModuleService = getContainer().resolve(Modules.ORDER)
      const order = await orderModuleService.createOrders({
        currency_code: "usd",
        email: "buyer@test.com",
        status: status as any,
        items: [{ title: "Shirt", quantity: 1, unit_price: 20 }],
      })
      return order
    }

    // Registers a driver and, unless told otherwise, activates it (there is
    // no admin activation endpoint yet).
    const createTestDriver = async (
      email: string,
      { active = true }: { active?: boolean } = {}
    ) => {
      const { driver, headers } = await createDriver(api, { email })

      if (active) {
        const driverModuleService: DriverModuleService =
          getContainer().resolve(DRIVER_MODULE)
        await driverModuleService.updateDrivers({ id: driver.id, is_active: true })
      }

      return { driver, headers }
    }

    const assignDriver = (
      orderId: string,
      body: Record<string, unknown>,
      headers: { headers: Record<string, string> } = adminHeaders
    ) =>
      api
        .post(`/admin/orders/${orderId}/assign-driver`, body, headers)
        .catch((e) => e.response)

    const linkTableName = async (): Promise<string> => {
      const pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const {
        rows: [{ table_name }],
      } = await pg.raw(
        `SELECT table_name FROM link_module_migrations
         WHERE link_descriptor->>'fromModule' = 'order'
           AND link_descriptor->>'toModule' = 'driver'`
      )
      return table_name
    }

    // Reads the link table directly so a duplicate row can't be hidden by
    // query.graph returning a single driver per order.
    const activeLinks = async (orderId: string) => {
      const pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const { rows } = await pg.raw(
        `SELECT order_id, driver_id FROM ?? WHERE order_id = ? AND deleted_at IS NULL`,
        [await linkTableName(), orderId]
      )
      return rows
    }

    // The test runner syncs links but does not run migration scripts.
    beforeEach(async () => {
      await orderDriverUniqueOrder({ container: getContainer() })
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("POST /admin/orders/:id/assign-driver", () => {
      it("assigns the driver and returns the order with it", async () => {
        const order = await createOrder()
        const { driver } = await createTestDriver("ana@test.com")

        const res = await assignDriver(order.id, { driver_id: driver.id })

        expect(res.status).toBe(200)
        expect(res.data.order).toEqual(
          expect.objectContaining({
            id: order.id,
            status: "pending",
            driver: expect.objectContaining({
              id: driver.id,
              first_name: "Ana",
              last_name: "Lopez",
              vehicle_type: "motorcycle",
            }),
          })
        )
        expect(await activeLinks(order.id)).toEqual([
          expect.objectContaining({ driver_id: driver.id }),
        ])
      })

      it("trims the driver_id", async () => {
        const order = await createOrder()
        const { driver } = await createTestDriver("ana@test.com")

        const res = await assignDriver(order.id, { driver_id: ` ${driver.id} ` })

        expect(res.status).toBe(200)
        expect(res.data.order.driver.id).toBe(driver.id)
      })

      it("replaces the previous driver when reassigning", async () => {
        const order = await createOrder()
        const { driver: ana } = await createTestDriver("ana@test.com")
        const { driver: luis } = await createTestDriver("luis@test.com")

        await assignDriver(order.id, { driver_id: ana.id })
        const res = await assignDriver(order.id, { driver_id: luis.id })

        expect(res.status).toBe(200)
        expect(res.data.order.driver.id).toBe(luis.id)
        expect(await activeLinks(order.id)).toEqual([
          expect.objectContaining({ driver_id: luis.id }),
        ])
      })

      it("keeps a single link when the same driver is assigned twice", async () => {
        const order = await createOrder()
        const { driver } = await createTestDriver("ana@test.com")

        await assignDriver(order.id, { driver_id: driver.id })
        const res = await assignDriver(order.id, { driver_id: driver.id })

        expect(res.status).toBe(200)
        expect(res.data.order.driver.id).toBe(driver.id)
        expect(await activeLinks(order.id)).toHaveLength(1)
      })

      it("lets one driver deliver several orders", async () => {
        const [first, second] = [await createOrder(), await createOrder()]
        const { driver } = await createTestDriver("ana@test.com")

        await assignDriver(first.id, { driver_id: driver.id })
        const res = await assignDriver(second.id, { driver_id: driver.id })

        expect(res.status).toBe(200)
        expect(await activeLinks(first.id)).toHaveLength(1)
        expect(await activeLinks(second.id)).toHaveLength(1)
      })

      it("assigns a driver to a requires_action order", async () => {
        const order = await createOrder("requires_action")
        const { driver } = await createTestDriver("ana@test.com")

        const res = await assignDriver(order.id, { driver_id: driver.id })

        expect(res.status).toBe(200)
      })

      it("keeps exactly one driver when two are assigned concurrently", async () => {
        const order = await createOrder()
        const { driver: ana } = await createTestDriver("ana@test.com")
        const { driver: luis } = await createTestDriver("luis@test.com")

        await Promise.all([
          assignDriver(order.id, { driver_id: ana.id }),
          assignDriver(order.id, { driver_id: luis.id }),
        ])

        const links = await activeLinks(order.id)
        expect(links).toHaveLength(1)
        expect([ana.id, luis.id]).toContain(links[0].driver_id)
      })

      it("returns 400 when driver_id is missing", async () => {
        const order = await createOrder()

        const res = await assignDriver(order.id, {})

        expect(res.status).toBe(400)
      })

      it("returns 400 when driver_id is only whitespace", async () => {
        const order = await createOrder()

        const res = await assignDriver(order.id, { driver_id: "   " })

        expect(res.status).toBe(400)
      })

      it("returns 400 for an unknown body field", async () => {
        const order = await createOrder()
        const { driver } = await createTestDriver("ana@test.com")

        const res = await assignDriver(order.id, {
          driver_id: driver.id,
          note: "fragile",
        })

        expect(res.status).toBe(400)
      })

      it.each(["canceled", "completed", "draft", "archived"])(
        "returns 400 when the order is %s",
        async (status) => {
          const order = await createOrder(status)
          const { driver } = await createTestDriver("ana@test.com")

          const res = await assignDriver(order.id, { driver_id: driver.id })

          expect(res.status).toBe(400)
          expect(res.data.message).toContain(status)
          expect(await activeLinks(order.id)).toHaveLength(0)
        }
      )

      it("returns 400 for an inactive driver", async () => {
        const order = await createOrder()
        const { driver } = await createTestDriver("ana@test.com", {
          active: false,
        })

        const res = await assignDriver(order.id, { driver_id: driver.id })

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(`Driver with id: ${driver.id} is not active`)
        expect(await activeLinks(order.id)).toHaveLength(0)
      })

      it("returns 400 for an already delivered order and keeps its driver", async () => {
        const order = await createOrder()
        const { driver: ana } = await createTestDriver("ana@test.com")
        const { driver: luis } = await createTestDriver("luis@test.com")
        await assignDriver(order.id, { driver_id: ana.id })

        const fulfillmentModuleService = getContainer().resolve(
          Modules.FULFILLMENT
        )
        const fulfillment = await fulfillmentModuleService.createFulfillment({
          location_id: "sloc_test",
          provider_id: "manual_manual",
          delivered_at: new Date(),
          delivery_address: {},
          items: [{ title: "Shirt", sku: "SHIRT", quantity: 1, barcode: "" }],
          labels: [],
        })
        await getContainer()
          .resolve(ContainerRegistrationKeys.LINK)
          .create({
            [Modules.ORDER]: { order_id: order.id },
            [Modules.FULFILLMENT]: { fulfillment_id: fulfillment.id },
          })

        const res = await assignDriver(order.id, { driver_id: luis.id })

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          `Order with id: ${order.id} was already delivered`
        )
        expect(await activeLinks(order.id)).toEqual([
          expect.objectContaining({ driver_id: ana.id }),
        ])
      })

      it("returns 404 for an unknown order", async () => {
        const { driver } = await createTestDriver("ana@test.com")

        const res = await assignDriver("order_unknown", { driver_id: driver.id })

        expect(res.status).toBe(404)
      })

      it("returns 404 for an unknown driver and keeps the current one", async () => {
        const order = await createOrder()
        const { driver } = await createTestDriver("ana@test.com")
        await assignDriver(order.id, { driver_id: driver.id })

        const res = await assignDriver(order.id, { driver_id: "drv_unknown" })

        expect(res.status).toBe(404)
        expect(await activeLinks(order.id)).toEqual([
          expect.objectContaining({ driver_id: driver.id }),
        ])
      })

      it("returns 401 without a token", async () => {
        const order = await createOrder()
        const { driver } = await createTestDriver("ana@test.com")

        const res = await assignDriver(
          order.id,
          { driver_id: driver.id },
          { headers: {} }
        )

        expect(res.status).toBe(401)
        expect(await activeLinks(order.id)).toHaveLength(0)
      })

      it("returns 401 with a driver token", async () => {
        const order = await createOrder()
        const { driver, headers } = await createTestDriver("ana@test.com")

        const res = await assignDriver(
          order.id,
          { driver_id: driver.id },
          { headers }
        )

        expect(res.status).toBe(401)
        expect(await activeLinks(order.id)).toHaveLength(0)
      })
    })

    describe("order-driver-unique-order migration script", () => {
      it("fails and names the orders already linked to two drivers", async () => {
        const pg = getContainer().resolve(
          ContainerRegistrationKeys.PG_CONNECTION
        )
        const order = await createOrder()
        const { driver: ana } = await createTestDriver("ana@test.com")
        const { driver: luis } = await createTestDriver("luis@test.com")

        // Simulate data written before the index existed.
        await pg.raw(`DROP INDEX ??`, [ORDER_DRIVER_UNIQUE_ORDER_INDEX])
        const tableName = await linkTableName()
        await pg.raw(
          `INSERT INTO ?? (id, order_id, driver_id) VALUES (?, ?, ?), (?, ?, ?)`,
          [
            tableName,
            "orddrv_dup_1",
            order.id,
            ana.id,
            "orddrv_dup_2",
            order.id,
            luis.id,
          ]
        )

        await expect(
          orderDriverUniqueOrder({ container: getContainer() })
        ).rejects.toThrow(`Orders linked to more than one driver: ${order.id}`)

        const { rows: indexes } = await pg.raw(
          `SELECT 1 FROM pg_indexes WHERE indexname = ?`,
          [ORDER_DRIVER_UNIQUE_ORDER_INDEX]
        )
        expect(indexes).toHaveLength(0)

        // Leave the table clean so the next beforeEach can recreate the index.
        await pg.raw(`DELETE FROM ?? WHERE order_id = ?`, [tableName, order.id])
      })
    })
  },
})
