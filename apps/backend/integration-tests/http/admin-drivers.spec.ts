import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { DRIVER_MODULE } from "../../src/modules/driver"
import DriverModuleService from "../../src/modules/driver/service"
import { createAdminUser } from "../helpers/admin-auth"
import {
  bearer,
  createDriver,
  defaultDriverBody,
  registerDriverIdentity,
} from "../helpers/driver-auth"

jest.setTimeout(60 * 1000)

const VALID_BODY = {
  ...defaultDriverBody,
  email: "ana@test.com",
}

type Driver = { id: string; email: string; is_active: boolean }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    const postDriver = (body: Record<string, unknown>, headers = adminHeaders) =>
      api.post("/admin/drivers", body, headers).catch((e) => e.response)

    const getDrivers = (path = "", headers = adminHeaders) =>
      api.get(`/admin/drivers${path}`, headers).catch((e) => e.response)

    const createDriverAsAdmin = async (
      body: Record<string, unknown> = {}
    ): Promise<Driver> => {
      const res = await api.post(
        "/admin/drivers",
        { ...VALID_BODY, ...body },
        adminHeaders
      )
      return res.data.driver
    }

    const countDrivers = async () => {
      const service: DriverModuleService = getContainer().resolve(DRIVER_MODULE)
      const [, count] = await service.listAndCountDrivers({})
      return count
    }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("POST /admin/drivers", () => {
      it("creates a driver without a login, inactive by default", async () => {
        const res = await postDriver({
          ...VALID_BODY,
          first_name: " Ana ",
          license_plate: "ABC-123",
          metadata: { shift: "morning" },
        })

        expect(res.status).toBe(200)
        expect(res.data.driver).toEqual({
          id: expect.stringMatching(/^drv_/),
          first_name: "Ana",
          last_name: "Lopez",
          email: "ana@test.com",
          phone: "+52 55 1234 5678",
          vehicle_type: "motorcycle",
          license_plate: "ABC-123",
          is_active: false,
          metadata: { shift: "morning" },
          created_at: expect.any(String),
          updated_at: expect.any(String),
        })
      })

      it("creates an active driver when is_active is true", async () => {
        const res = await postDriver({ ...VALID_BODY, is_active: true })

        expect(res.status).toBe(200)
        expect(res.data.driver.is_active).toBe(true)
      })

      it("returns only the requested fields", async () => {
        const res = await api.post(
          "/admin/drivers?fields=id,email",
          VALID_BODY,
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.driver).toEqual({
          id: expect.stringMatching(/^drv_/),
          email: "ana@test.com",
        })
      })

      it.each([
        ["missing first_name", { first_name: undefined }],
        ["blank last_name", { last_name: "   " }],
        ["missing email", { email: undefined }],
        ["invalid email", { email: "not-an-email" }],
        ["blank phone", { phone: " " }],
        ["unknown vehicle_type", { vehicle_type: "truck" }],
        ["non-boolean is_active", { is_active: "yes" }],
        ["unknown field", { password: "secret123" }],
      ])("rejects %s with 400", async (_, override) => {
        const res = await postDriver({ ...VALID_BODY, ...override })

        expect(res.status).toBe(400)
        expect(res.data.type).toBe("invalid_data")
        expect(await countDrivers()).toBe(0)
      })

      it("rejects an email another admin-created driver uses with 400", async () => {
        await createDriverAsAdmin()

        const res = await postDriver({ ...VALID_BODY, first_name: "Other" })

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("A driver with this email already exists")
        expect(await countDrivers()).toBe(1)
      })

      it("rejects the email of a self-registered driver with 400", async () => {
        await createDriver(api, { email: "ana@test.com" })

        const res = await postDriver(VALID_BODY)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("A driver with this email already exists")
        expect(await countDrivers()).toBe(1)
      })

      it("creates one driver when the same email is posted concurrently", async () => {
        const responses = await Promise.all(
          Array.from({ length: 5 }, () => postDriver(VALID_BODY))
        )
        const statuses = responses.map((res) => res.status)

        expect(statuses.filter((status) => status === 200)).toHaveLength(1)
        responses
          .filter((res) => res.status !== 200)
          .forEach((res) => {
            expect(res.status).toBe(400)
            expect(res.data.message).toBe(
              "A driver with this email already exists"
            )
          })
        expect(await countDrivers()).toBe(1)
      })

      it("blocks self-registration with an admin-created driver's email", async () => {
        await createDriverAsAdmin()

        // The invitation is pending, so sign-up points to it (see T14.1).
        const registerRes = await api
          .post("/auth/driver/emailpass/register", {
            email: "ana@test.com",
            password: "supersecret",
          })
          .catch((e) => e.response)

        expect(registerRes.status).toBe(400)
        expect(registerRes.data.message).toMatch(/pending driver invitation/)
        expect(await countDrivers()).toBe(1)
      })

      it("blocks POST /drivers with the email of a driver without an invitation", async () => {
        // Drivers created before T14.1 have no invitation.
        const token = await registerDriverIdentity(api, {
          email: "ana@test.com",
        })
        const service: DriverModuleService = getContainer().resolve(DRIVER_MODULE)
        await service.createDrivers({ ...VALID_BODY, vehicle_type: "car" })

        const res = await api
          .post("/drivers", defaultDriverBody, bearer(token))
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("A driver with this email already exists")
        expect(await countDrivers()).toBe(1)
      })

      it("returns 401 without a token", async () => {
        const res = await postDriver(VALID_BODY, { headers: {} })

        expect(res.status).toBe(401)
        expect(await countDrivers()).toBe(0)
      })

      it("returns 401 with a driver token", async () => {
        const { headers } = await createDriver(api, {
          email: "driver@test.com",
        })

        const res = await postDriver(VALID_BODY, { headers })

        expect(res.status).toBe(401)
        expect(await countDrivers()).toBe(1)
      })
    })

    describe("GET /admin/drivers", () => {
      it("lists drivers newest first with pagination metadata", async () => {
        const first = await createDriverAsAdmin({ email: "a@test.com" })
        const second = await createDriverAsAdmin({ email: "b@test.com" })
        const { driver: third } = await createDriver(api, {
          email: "c@test.com",
        })

        const res = await getDrivers()

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          drivers: [
            expect.objectContaining({ id: third.id, email: "c@test.com" }),
            expect.objectContaining({ id: second.id, email: "b@test.com" }),
            expect.objectContaining({ id: first.id, email: "a@test.com" }),
          ],
          count: 3,
          offset: 0,
          limit: 20,
        })
        expect(Object.keys(res.data.drivers[0]).sort()).toEqual(
          [
            "created_at",
            "email",
            "first_name",
            "id",
            "is_active",
            "last_name",
            "license_plate",
            "metadata",
            "phone",
            "updated_at",
            "vehicle_type",
          ].sort()
        )
      })

      it("paginates with limit and offset without skipping or repeating", async () => {
        const created: Driver[] = []
        for (let i = 0; i < 5; i++) {
          created.push(await createDriverAsAdmin({ email: `d${i}@test.com` }))
        }

        const pageOne = await getDrivers("?limit=2&offset=0")
        const pageTwo = await getDrivers("?limit=2&offset=2")
        const pageThree = await getDrivers("?limit=2&offset=4")

        expect(pageOne.data).toEqual(
          expect.objectContaining({ count: 5, offset: 0, limit: 2 })
        )
        expect(pageThree.data).toEqual(
          expect.objectContaining({ count: 5, offset: 4, limit: 2 })
        )

        const ids = [pageOne, pageTwo, pageThree].flatMap((page) =>
          page.data.drivers.map((driver: Driver) => driver.id)
        )
        expect(ids).toHaveLength(5)
        expect(new Set(ids)).toEqual(new Set(created.map((d) => d.id)))
      })

      it("filters by is_active", async () => {
        const active = await createDriverAsAdmin({
          email: "active@test.com",
          is_active: true,
        })
        const pending = await createDriverAsAdmin({ email: "pending@test.com" })

        const activeRes = await getDrivers("?is_active=true")
        const pendingRes = await getDrivers("?is_active=false")

        expect(activeRes.data.drivers.map((d: Driver) => d.id)).toEqual([
          active.id,
        ])
        expect(activeRes.data.count).toBe(1)
        expect(pendingRes.data.drivers.map((d: Driver) => d.id)).toEqual([
          pending.id,
        ])
        expect(pendingRes.data.count).toBe(1)
      })

      it("returns an empty page when there are no drivers", async () => {
        const res = await getDrivers()

        expect(res.status).toBe(200)
        expect(res.data).toEqual({ drivers: [], count: 0, offset: 0, limit: 20 })
      })

      it.each([
        ["non-boolean is_active", "?is_active=yes"],
        ["non-numeric limit", "?limit=abc"],
        ["unknown parameter", "?status=active"],
        ["with_deleted", "?with_deleted=true"],
      ])("rejects %s with 400", async (_, path) => {
        const res = await getDrivers(path)

        expect(res.status).toBe(400)
        expect(res.data.type).toBe("invalid_data")
      })

      it("returns 401 without a token", async () => {
        const res = await getDrivers("", { headers: {} })

        expect(res.status).toBe(401)
      })

      it("returns 401 with a driver token", async () => {
        const { headers } = await createDriver(api, {
          email: "driver@test.com",
        })

        const res = await getDrivers("", { headers })

        expect(res.status).toBe(401)
      })
    })
  },
})
