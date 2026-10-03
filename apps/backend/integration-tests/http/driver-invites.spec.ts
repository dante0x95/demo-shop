import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { DRIVER_MODULE } from "../../src/modules/driver"
import DriverModuleService from "../../src/modules/driver/service"
import { hashDriverInviteToken } from "../../src/workflows/driver/utils/driver-invite"
import { createAdminUser } from "../helpers/admin-auth"
import {
  bearer,
  createDriver,
  decodeJwtPayload,
  defaultDriverBody,
  registerDriverIdentity,
} from "../helpers/driver-auth"

jest.setTimeout(60 * 1000)

const EMAIL = "ana@test.com"
const PASSWORD = "chosen-secret"
const DAY_MS = 24 * 60 * 60 * 1000

const PENDING_INVITE_MESSAGE =
  "This email has a pending driver invitation. Check your email for the invitation link to set your password."

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    const driverService = (): DriverModuleService =>
      getContainer().resolve(DRIVER_MODULE)

    const notificationService = (): INotificationModuleService =>
      getContainer().resolve(Modules.NOTIFICATION)

    const inviteNotifications = (email = EMAIL) =>
      notificationService().listNotifications(
        { to: email, template: "driver-invite" },
        { order: { created_at: "DESC" } }
      )

    // Token from the most recent invitation email sent to `email`.
    const latestToken = async (email = EMAIL): Promise<string> => {
      const [notification] = await inviteNotifications(email)
      return notification.data!.token as string
    }

    const inviteOf = async (driverId: string) => {
      const [invite] = await driverService().listDriverInvites({
        driver_id: driverId,
      })
      return invite
    }

    const createDriverAsAdmin = async (body: Record<string, unknown> = {}) => {
      const res = await api.post(
        "/admin/drivers",
        { ...defaultDriverBody, email: EMAIL, ...body },
        adminHeaders
      )
      return res.data.driver as { id: string; email: string }
    }

    const accept = (body: Record<string, unknown>) =>
      api.post("/drivers/invites/accept", body).catch((e) => e.response)

    const resend = (
      id: string,
      body: Record<string, unknown> = {},
      headers = adminHeaders
    ) =>
      api
        .post(`/admin/drivers/${id}/resend-invite`, body, headers)
        .catch((e) => e.response)

    const login = (email = EMAIL, password = PASSWORD) =>
      api
        .post("/auth/driver/emailpass", { email, password })
        .catch((e) => e.response)

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    afterEach(() => {
      delete process.env.DRIVER_INVITE_URL
    })

    describe("POST /admin/drivers sends an invitation", () => {
      it("emails a 7-day link and stores only the token's hash", async () => {
        const before = Date.now()
        const driver = await createDriverAsAdmin()

        const notifications = await inviteNotifications()
        expect(notifications).toHaveLength(1)
        expect(notifications[0]).toEqual(
          expect.objectContaining({
            to: EMAIL,
            channel: "email",
            template: "driver-invite",
            status: "success",
            resource_id: driver.id,
            resource_type: "driver",
          })
        )

        const { token, invite_url, first_name, driver_id } = notifications[0]
          .data as Record<string, unknown>
        expect(token).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/))
        expect(invite_url).toBeNull()
        expect(first_name).toBe("Ana")
        expect(driver_id).toBe(driver.id)

        const invite = await inviteOf(driver.id)
        expect(invite.token_hash).toBe(hashDriverInviteToken(token as string))
        expect(invite.token_hash).not.toBe(token)
        expect(invite.accepted_at).toBeNull()

        const expiresAt = new Date(invite.expires_at).getTime()
        expect(expiresAt).toBeGreaterThanOrEqual(before + 7 * DAY_MS)
        expect(expiresAt).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS)
      })

      it("builds the link from DRIVER_INVITE_URL when it is set", async () => {
        process.env.DRIVER_INVITE_URL = "https://drivers.example.com/invite"

        await createDriverAsAdmin()

        const [notification] = await inviteNotifications()
        const { token, invite_url } = notification.data as Record<
          string,
          string
        >
        expect(invite_url).toBe(
          `https://drivers.example.com/invite?token=${token}`
        )
      })

      it("sends nothing when the driver can't be created", async () => {
        await createDriverAsAdmin()

        const res = await api
          .post(
            "/admin/drivers",
            { ...defaultDriverBody, email: EMAIL },
            adminHeaders
          )
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(await inviteNotifications()).toHaveLength(1)
        expect(await driverService().listDriverInvites({})).toHaveLength(1)
      })
    })

    describe("POST /drivers/invites/accept", () => {
      it("creates the driver's login, linked to the driver", async () => {
        const driver = await createDriverAsAdmin()
        const token = await latestToken()

        const res = await accept({ token, password: PASSWORD })

        expect(res.status).toBe(200)
        expect(res.data.driver).toEqual(
          expect.objectContaining({ id: driver.id, email: EMAIL })
        )
        expect((await inviteOf(driver.id)).accepted_at).not.toBeNull()

        const loginRes = await login()
        expect(loginRes.status).toBe(200)
        expect(decodeJwtPayload(loginRes.data.token)).toEqual(
          expect.objectContaining({
            actor_type: "driver",
            actor_id: driver.id,
          })
        )

        const me = await api.get("/drivers/me", bearer(loginRes.data.token))
        expect(me.data.driver.id).toBe(driver.id)
      })

      it("rejects a link that was already used", async () => {
        await createDriverAsAdmin()
        const token = await latestToken()
        expect((await accept({ token, password: PASSWORD })).status).toBe(200)

        const again = await accept({ token, password: "another-secret" })

        expect(again.status).toBe(400)
        expect(again.data.message).toBe(
          "This invitation was already accepted. Log in with your email and password."
        )
        expect((await login()).status).toBe(200)
        expect((await login(EMAIL, "another-secret")).status).toBe(401)
      })

      it("rejects an expired link and creates no login", async () => {
        const driver = await createDriverAsAdmin()
        const token = await latestToken()
        const invite = await inviteOf(driver.id)
        await driverService().updateDriverInvites({
          id: invite.id,
          expires_at: new Date(Date.now() - 1000),
        })

        const res = await accept({ token, password: PASSWORD })

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          "This invitation link has expired. Ask for a new invitation."
        )
        const identities = await getContainer()
          .resolve(Modules.AUTH)
          .listProviderIdentities({ entity_id: EMAIL })
        expect(identities).toHaveLength(0)
        expect((await inviteOf(driver.id)).accepted_at).toBeNull()
      })

      it("rejects an unknown token", async () => {
        const res = await accept({ token: "not-a-token", password: PASSWORD })

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          "This invitation link is invalid. Ask for a new invitation."
        )
      })

      it("sets the password of a sign-up that stopped at 'email taken'", async () => {
        // The identity exists from before the admin created the driver.
        const registrationToken = await registerDriverIdentity(api, {
          email: EMAIL,
          password: "old-secret",
        })
        const driver = await createDriverAsAdmin()

        const res = await accept({
          token: await latestToken(),
          password: PASSWORD,
        })

        expect(res.status).toBe(200)
        expect((await login(EMAIL, "old-secret")).status).toBe(401)
        const loginRes = await login()
        expect(loginRes.status).toBe(200)
        expect(decodeJwtPayload(loginRes.data.token)).toEqual(
          expect.objectContaining({
            actor_id: driver.id,
            auth_identity_id:
              decodeJwtPayload(registrationToken).auth_identity_id,
          })
        )
      })

      it.each([
        ["missing token", { password: PASSWORD }],
        ["blank token", { token: "  ", password: PASSWORD }],
        ["missing password", { token: "abc" }],
        ["empty password", { token: "abc", password: "" }],
        ["unknown field", { token: "abc", password: PASSWORD, email: EMAIL }],
      ])("rejects %s with 400", async (_, body) => {
        const res = await accept(body)

        expect(res.status).toBe(400)
        expect(res.data.type).toBe("invalid_data")
      })
    })

    describe("pending invitation blocks login and sign-up", () => {
      it("returns the 'check your email' error on login", async () => {
        await createDriverAsAdmin()

        const res = await login()

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(PENDING_INVITE_MESSAGE)
      })

      it("still points to the invitation once the link has expired", async () => {
        const driver = await createDriverAsAdmin()
        const invite = await inviteOf(driver.id)
        await driverService().updateDriverInvites({
          id: invite.id,
          expires_at: new Date(Date.now() - 1000),
        })

        const res = await login()

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(PENDING_INVITE_MESSAGE)
      })

      it("returns the error on sign-up and creates no identity", async () => {
        await createDriverAsAdmin()

        const res = await api
          .post("/auth/driver/emailpass/register", {
            email: EMAIL,
            password: "supersecret",
          })
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(PENDING_INVITE_MESSAGE)
        const identities = await getContainer()
          .resolve(Modules.AUTH)
          .listProviderIdentities({ entity_id: EMAIL })
        expect(identities).toHaveLength(0)
      })

      it("returns the error on POST /drivers with an earlier sign-up token", async () => {
        const registrationToken = await registerDriverIdentity(api, {
          email: EMAIL,
        })
        await createDriverAsAdmin()

        const res = await api
          .post("/drivers", defaultDriverBody, bearer(registrationToken))
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(PENDING_INVITE_MESSAGE)
        expect(await driverService().listDrivers({ email: EMAIL })).toHaveLength(
          1
        )
      })

      it("leaves other emails and accepted invitations alone", async () => {
        await createDriverAsAdmin()
        await accept({ token: await latestToken(), password: PASSWORD })

        expect((await login()).status).toBe(200)
        const unknown = await login("nobody@test.com", "whatever")
        expect(unknown.status).toBe(401)
      })
    })

    describe("POST /admin/drivers/:id/resend-invite", () => {
      it("sends a new link and invalidates the previous one", async () => {
        const driver = await createDriverAsAdmin()
        const firstToken = await latestToken()

        const res = await resend(driver.id)

        expect(res.status).toBe(200)
        expect(res.data.driver).toEqual(
          expect.objectContaining({ id: driver.id, email: EMAIL })
        )
        expect(await inviteNotifications()).toHaveLength(2)
        const secondToken = await latestToken()
        expect(secondToken).not.toBe(firstToken)
        expect(await driverService().listDriverInvites({})).toHaveLength(1)

        const old = await accept({ token: firstToken, password: PASSWORD })
        expect(old.status).toBe(400)
        expect(old.data.message).toBe(
          "This invitation link is invalid. Ask for a new invitation."
        )

        const fresh = await accept({ token: secondToken, password: PASSWORD })
        expect(fresh.status).toBe(200)
        expect((await login()).status).toBe(200)
      })

      it("renews an expired invitation for another 7 days", async () => {
        const driver = await createDriverAsAdmin()
        const invite = await inviteOf(driver.id)
        await driverService().updateDriverInvites({
          id: invite.id,
          expires_at: new Date(Date.now() - 1000),
        })

        expect((await resend(driver.id)).status).toBe(200)

        const renewed = await inviteOf(driver.id)
        expect(new Date(renewed.expires_at).getTime()).toBeGreaterThan(
          Date.now() + 6 * DAY_MS
        )
        const res = await accept({
          token: await latestToken(),
          password: PASSWORD,
        })
        expect(res.status).toBe(200)
      })

      it("invites a driver created before invitations existed", async () => {
        const [driver] = await driverService().createDrivers([
          { ...defaultDriverBody, vehicle_type: "car", email: EMAIL },
        ])
        expect(await inviteOf(driver.id)).toBeUndefined()

        const res = await resend(driver.id)

        expect(res.status).toBe(200)
        expect(await inviteNotifications()).toHaveLength(1)
        const acceptRes = await accept({
          token: await latestToken(),
          password: PASSWORD,
        })
        expect(acceptRes.status).toBe(200)
        expect((await login()).status).toBe(200)
      })

      it("rejects a driver whose invitation was accepted with 400", async () => {
        const driver = await createDriverAsAdmin()
        await accept({ token: await latestToken(), password: PASSWORD })

        const res = await resend(driver.id)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("This driver already has a login")
        expect(await inviteNotifications()).toHaveLength(1)
      })

      it("rejects a self-registered driver with 400", async () => {
        const { driver } = await createDriver(api, { email: EMAIL })

        const res = await resend(driver.id)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("This driver already has a login")
        expect(await inviteNotifications()).toHaveLength(0)
        expect(await inviteOf(driver.id)).toBeUndefined()
      })

      it("rejects a body with fields with 400", async () => {
        const driver = await createDriverAsAdmin()

        const res = await resend(driver.id, { email: "other@test.com" })

        expect(res.status).toBe(400)
        expect(res.data.type).toBe("invalid_data")
        expect(await inviteNotifications()).toHaveLength(1)
      })

      it("returns 404 for an unknown driver", async () => {
        const res = await resend("drv_unknown")

        expect(res.status).toBe(404)
      })

      it("returns 401 without a token", async () => {
        const driver = await createDriverAsAdmin()

        const res = await resend(driver.id, {}, { headers: {} })

        expect(res.status).toBe(401)
        expect(await inviteNotifications()).toHaveLength(1)
      })

      it("returns 401 with a driver token", async () => {
        const driver = await createDriverAsAdmin()
        const { headers } = await createDriver(api, {
          email: "other@test.com",
        })

        const res = await resend(driver.id, {}, { headers })

        expect(res.status).toBe(401)
      })
    })
  },
})
