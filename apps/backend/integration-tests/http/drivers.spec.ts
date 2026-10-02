import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { DRIVER_MODULE } from "../../src/modules/driver"
import DriverModuleService from "../../src/modules/driver/service"
import { createAdminUser } from "../helpers/admin-auth"
import {
  bearer,
  createDriver,
  decodeJwtPayload,
  defaultDriverBody,
  registerDriverIdentity,
} from "../helpers/driver-auth"

jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const postDriver = (body: Record<string, unknown>, token?: string) =>
      api
        .post("/drivers", body, token ? bearer(token) : undefined)
        .catch((e) => e.response)

    describe("POST /drivers", () => {
      it("registers a driver, links it to the identity and allows login", async () => {
        const token = await registerDriverIdentity(api, {
          email: "ana@test.com",
          password: "secret123",
        })

        const res = await postDriver(defaultDriverBody, token)

        expect(res.status).toBe(200)
        expect(res.data.driver).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^drv_/),
            first_name: "Ana",
            last_name: "Lopez",
            email: "ana@test.com",
            phone: "+52 55 1234 5678",
            vehicle_type: "motorcycle",
            license_plate: null,
            is_active: false,
            metadata: null,
          })
        )

        const { auth_identity_id } = decodeJwtPayload(token)
        const authModuleService = getContainer().resolve(Modules.AUTH)
        const identity = await authModuleService.retrieveAuthIdentity(
          auth_identity_id
        )
        expect(identity.app_metadata).toEqual(
          expect.objectContaining({ driver_id: res.data.driver.id })
        )

        const loginRes = await api.post("/auth/driver/emailpass", {
          email: "ana@test.com",
          password: "secret123",
        })

        expect(loginRes.status).toBe(200)
        expect(decodeJwtPayload(loginRes.data.token)).toEqual(
          expect.objectContaining({
            actor_type: "driver",
            actor_id: res.data.driver.id,
          })
        )
      })

      it("stores optional license_plate and metadata, trimming strings", async () => {
        const token = await registerDriverIdentity(api)

        const res = await postDriver(
          {
            first_name: "  Luis ",
            last_name: "Perez",
            phone: " 5512345678 ",
            vehicle_type: "car",
            license_plate: " ABC-123 ",
            metadata: { shift: "night" },
          },
          token
        )

        expect(res.status).toBe(200)
        expect(res.data.driver).toEqual(
          expect.objectContaining({
            first_name: "Luis",
            phone: "5512345678",
            vehicle_type: "car",
            license_plate: "ABC-123",
            metadata: { shift: "night" },
            is_active: false,
          })
        )
      })

      it("returns 400 when first_name is missing", async () => {
        const token = await registerDriverIdentity(api)
        const { first_name, ...body } = defaultDriverBody

        const res = await postDriver(body, token)

        expect(res.status).toBe(400)
      })

      it("returns 400 when phone is only whitespace", async () => {
        const token = await registerDriverIdentity(api)

        const res = await postDriver({ ...defaultDriverBody, phone: "   " }, token)

        expect(res.status).toBe(400)
      })

      it("returns 400 for an unknown vehicle_type", async () => {
        const token = await registerDriverIdentity(api)

        const res = await postDriver(
          { ...defaultDriverBody, vehicle_type: "truck" },
          token
        )

        expect(res.status).toBe(400)
      })

      it.each([
        ["is_active", true],
        ["email", "other@test.com"],
      ])("returns 400 when the body sets %s", async (field, value) => {
        const token = await registerDriverIdentity(api)

        const res = await postDriver(
          { ...defaultDriverBody, [field]: value },
          token
        )

        expect(res.status).toBe(400)
      })

      it("returns 400 when the identity already has a driver", async () => {
        const token = await registerDriverIdentity(api, {
          email: "twice@test.com",
          password: "supersecret",
        })

        const first = await postDriver(defaultDriverBody, token)
        expect(first.status).toBe(200)

        const again = await postDriver(defaultDriverBody, token)
        expect(again.status).toBe(400)
        expect(again.data.message).toBe(
          "A driver account already exists for this identity"
        )

        const loginRes = await api.post("/auth/driver/emailpass", {
          email: "twice@test.com",
          password: "supersecret",
        })
        const withLoginToken = await postDriver(
          defaultDriverBody,
          loginRes.data.token
        )
        expect(withLoginToken.status).toBe(400)

        const driverModuleService: DriverModuleService =
          getContainer().resolve(DRIVER_MODULE)
        const drivers = await driverModuleService.listDrivers({
          email: "twice@test.com",
        })
        expect(drivers).toHaveLength(1)
      })

      it("returns 401 without a token", async () => {
        const res = await postDriver(defaultDriverBody)

        expect(res.status).toBe(401)
      })

      it("returns 401 with an admin token", async () => {
        const adminHeaders = await createAdminUser(api, getContainer())

        const res = await api
          .post("/drivers", defaultDriverBody, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })

      it("returns 401 with a customer registration token", async () => {
        const customerRes = await api.post("/auth/customer/emailpass/register", {
          email: "customer@test.com",
          password: "supersecret",
        })

        const res = await postDriver(defaultDriverBody, customerRes.data.token)

        expect(res.status).toBe(401)
      })
    })

    describe("createDriver helper", () => {
      it("returns headers that authenticate as the new driver", async () => {
        const { driver, headers } = await createDriver(api, {
          email: "helper@test.com",
        })

        expect(driver.id).toMatch(/^drv_/)
        expect(
          decodeJwtPayload(headers.authorization.replace("Bearer ", ""))
        ).toEqual(expect.objectContaining({ actor_id: driver.id }))
      })
    })
  },
})
