import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
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
    const getMe = (path: string, headers?: { authorization: string }) =>
      api
        .get(path, headers ? { headers } : undefined)
        .catch((e) => e.response)

    describe("GET /drivers/me", () => {
      it("returns the authenticated driver, even while inactive", async () => {
        const { driver, headers } = await createDriver(api, {
          email: "me@test.com",
        })

        const res = await getMe("/drivers/me", headers)

        expect(res.status).toBe(200)
        expect(res.data.driver).toEqual(driver)
        expect(res.data.driver).toEqual(
          expect.objectContaining({ email: "me@test.com", is_active: false })
        )
      })

      it("returns only the caller's own profile", async () => {
        const a = await createDriver(api, { email: "a@test.com" })
        const b = await createDriver(api, { email: "b@test.com" })

        const resA = await getMe("/drivers/me", a.headers)
        const resB = await getMe("/drivers/me", b.headers)

        expect(resA.data.driver.id).toBe(a.driver.id)
        expect(resB.data.driver.id).toBe(b.driver.id)
      })

      it("returns only the requested fields", async () => {
        const { driver, headers } = await createDriver(api)

        const res = await getMe("/drivers/me?fields=id,email", headers)

        expect(res.status).toBe(200)
        expect(res.data.driver).toEqual({ id: driver.id, email: driver.email })
      })

      it("returns 400 for unknown query params", async () => {
        const { headers } = await createDriver(api)

        const res = await getMe("/drivers/me?with_deleted=true", headers)

        expect(res.status).toBe(400)
      })

      it("returns 404 when the driver no longer exists", async () => {
        const { driver, headers } = await createDriver(api)
        const driverModuleService: DriverModuleService =
          getContainer().resolve(DRIVER_MODULE)
        await driverModuleService.softDeleteDrivers(driver.id)

        const res = await getMe("/drivers/me", headers)

        expect(res.status).toBe(404)
        expect(res.data.message).toBe("Driver not found")
      })

      it("returns 401 without a token", async () => {
        const res = await getMe("/drivers/me")

        expect(res.status).toBe(401)
      })

      it("returns 401 with an admin token", async () => {
        const { headers } = await createAdminUser(api, getContainer())

        const res = await getMe("/drivers/me", headers)

        expect(res.status).toBe(401)
      })

      it("returns 401 with a registration token that has no driver yet", async () => {
        const token = await registerDriverIdentity(api)

        const res = await getMe("/drivers/me", bearer(token).headers)

        expect(res.status).toBe(401)
      })

      it("returns 401 with a customer token", async () => {
        const customerRes = await api.post("/auth/customer/emailpass/register", {
          email: "customer@test.com",
          password: "supersecret",
        })

        const res = await getMe(
          "/drivers/me",
          bearer(customerRes.data.token).headers
        )

        expect(res.status).toBe(401)
      })
    })
  },
})
