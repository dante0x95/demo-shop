import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { DRIVER_MODULE } from "../../src/modules/driver"
import DriverModuleService from "../../src/modules/driver/service"
import { hashDriverInviteToken } from "../../src/workflows/driver/utils/driver-invite"
import { createAdminUser } from "../helpers/admin-auth"
import { createCustomerWithLogin } from "../helpers/customer-auth"
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

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const PENDING_INVITE_MESSAGE =
  "This email has a pending driver invitation. Check your email for the invitation link to set your password."
const EXPIRED_INVITE_MESSAGE =
  "Your driver invitation expired. Ask the store for a new one."
const UNKNOWN_LINK_MESSAGE =
  "This invitation link is invalid. Ask the store for a new invitation."
const EXPIRED_LINK_MESSAGE =
  "This invitation link has expired. Ask the store for a new invitation."
const REPLACED_LINK_MESSAGE =
  "This invitation link was replaced by a newer one. Use the link in the latest invitation email."
const ACCEPTED_MESSAGE =
  "This invitation was already accepted. Log in with your email and password."
const EMAIL_TAKEN_MESSAGE = "This email is already used by another account"
const HAS_LOGIN_MESSAGE = "This driver already has a login"

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

    const invitesOf = (driverId: string) =>
      driverService().listDriverInvites(
        { driver_id: driverId },
        { order: { created_at: "ASC" } }
      )

    const inviteByToken = async (token: string) => {
      const [invite] = await driverService().listDriverInvites({
        token_hash: hashDriverInviteToken(token),
      })
      return invite
    }

    // Moves an invitation's window into the past, as if 7 days went by.
    const expire = (id: string) =>
      driverService().updateDriverInvites({
        id,
        expires_at: new Date(Date.now() - 1000),
      })

    const identitiesOf = (email = EMAIL) =>
      getContainer()
        .resolve(Modules.AUTH)
        .listProviderIdentities({ entity_id: email }, { relations: ["auth_identity"] })

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

    const signUp = (email = EMAIL) =>
      api
        .post("/auth/driver/emailpass/register", {
          email,
          password: "supersecret",
        })
        .catch((e) => e.response)

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    afterEach(() => {
      delete process.env.DRIVER_INVITE_URL
    })

    describe("POST /admin/drivers sends an invitation", () => {
      it("emails a 7-day link and stores a pending record with only the token's hash", async () => {
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

        const [invite, ...others] = await invitesOf(driver.id)
        expect(others).toHaveLength(0)
        expect(invite.status).toBe("pending")
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
        const [invite] = await invitesOf(driver.id)
        expect(invite.status).toBe("accepted")
        expect(invite.accepted_at).not.toBeNull()

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

      it("rejects a link that was already used with 409", async () => {
        await createDriverAsAdmin()
        const token = await latestToken()
        expect((await accept({ token, password: PASSWORD })).status).toBe(200)

        const again = await accept({ token, password: "another-secret" })

        expect(again.status).toBe(409)
        expect(again.data).toEqual({
          type: "conflict",
          message: ACCEPTED_MESSAGE,
        })
        expect((await login()).status).toBe(200)
        expect((await login(EMAIL, "another-secret")).status).toBe(401)
      })

      it("lets only one of two concurrent acceptances set the password", async () => {
        await createDriverAsAdmin()
        const token = await latestToken()

        const responses = await Promise.all([
          accept({ token, password: "first-secret" }),
          accept({ token, password: "second-secret" }),
        ])

        const statuses = responses.map((res) => res.status).sort()
        expect(statuses).toEqual([200, 409])
        const winner = responses.find((res) => res.status === 200)!
        const password =
          responses.indexOf(winner) === 0 ? "first-secret" : "second-secret"
        const loser = password === "first-secret" ? "second-secret" : "first-secret"
        expect((await login(EMAIL, password)).status).toBe(200)
        expect((await login(EMAIL, loser)).status).toBe(401)
      })

      it("rejects an expired link with 410 and creates no login", async () => {
        const driver = await createDriverAsAdmin()
        const token = await latestToken()
        const [invite] = await invitesOf(driver.id)
        await expire(invite.id)

        const res = await accept({ token, password: PASSWORD })

        expect(res.status).toBe(410)
        expect(res.data.message).toBe(EXPIRED_LINK_MESSAGE)
        expect(await identitiesOf()).toHaveLength(0)
        expect((await inviteByToken(token)).accepted_at).toBeNull()
      })

      it("checks the stored status, not only the token: a revoked record is rejected with 410", async () => {
        const driver = await createDriverAsAdmin()
        const token = await latestToken()
        const [invite] = await invitesOf(driver.id)
        await driverService().updateDriverInvites({
          id: invite.id,
          status: "revoked",
        })

        const res = await accept({ token, password: PASSWORD })

        expect(res.status).toBe(410)
        expect(res.data.message).toBe(REPLACED_LINK_MESSAGE)
        expect(await identitiesOf()).toHaveLength(0)
      })

      it("rejects an unknown token with 404", async () => {
        const res = await accept({ token: "not-a-token", password: PASSWORD })

        expect(res.status).toBe(404)
        expect(res.data.message).toBe(UNKNOWN_LINK_MESSAGE)
      })

      it("takes over a login with no role (a sign-up that stopped at 'email taken')", async () => {
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

      it("rejects with 409 when a customer took the email after the invitation was sent", async () => {
        const driver = await createDriverAsAdmin()
        const token = await latestToken()
        await createCustomerWithLogin(api, getContainer(), {
          email: EMAIL,
          password: "customer-secret",
        })

        const res = await accept({ token, password: PASSWORD })

        expect(res.status).toBe(409)
        expect(res.data).toEqual({
          type: "conflict",
          message: EMAIL_TAKEN_MESSAGE,
        })
        // Nothing changed: the invitation is still usable, the customer keeps
        // their password and the login is not linked to the driver.
        const [invite] = await invitesOf(driver.id)
        expect(invite.status).toBe("pending")
        expect(invite.accepted_at).toBeNull()
        const [identity] = await identitiesOf()
        expect(identity.auth_identity!.app_metadata).not.toHaveProperty(
          "driver_id"
        )
        const customerLogin = await api
          .post("/auth/customer/emailpass", {
            email: EMAIL,
            password: "customer-secret",
          })
          .catch((e) => e.response)
        expect(customerLogin.status).toBe(200)
      })

      it("rejects with 409 when an admin took the email after the invitation was sent", async () => {
        await createDriverAsAdmin()
        const token = await latestToken()
        await createAdminUser(api, getContainer(), { email: EMAIL })

        const res = await accept({ token, password: PASSWORD })

        expect(res.status).toBe(409)
        expect(res.data.message).toBe(EMAIL_TAKEN_MESSAGE)
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

    describe("an unaccepted invitation blocks login and sign-up with 403", () => {
      it("points to the email on login while the invitation is pending", async () => {
        await createDriverAsAdmin()

        const res = await login()

        expect(res.status).toBe(403)
        expect(res.data.message).toBe(PENDING_INVITE_MESSAGE)
      })

      it("points to the store on login once the invitation expired", async () => {
        const driver = await createDriverAsAdmin()
        const [invite] = await invitesOf(driver.id)
        await expire(invite.id)

        const res = await login()

        expect(res.status).toBe(403)
        expect(res.data.message).toBe(EXPIRED_INVITE_MESSAGE)
      })

      it("points to the email on sign-up and creates no identity", async () => {
        await createDriverAsAdmin()

        const res = await signUp()

        expect(res.status).toBe(403)
        expect(res.data.message).toBe(PENDING_INVITE_MESSAGE)
        expect(await identitiesOf()).toHaveLength(0)
      })

      it("keeps sign-up blocked once the invitation expired", async () => {
        const driver = await createDriverAsAdmin()
        const [invite] = await invitesOf(driver.id)
        await expire(invite.id)

        const res = await signUp()

        expect(res.status).toBe(403)
        expect(res.data.message).toBe(EXPIRED_INVITE_MESSAGE)
        expect(await identitiesOf()).toHaveLength(0)
      })

      it("blocks POST /drivers with an earlier sign-up token, pending or expired", async () => {
        const registrationToken = await registerDriverIdentity(api, {
          email: EMAIL,
        })
        const driver = await createDriverAsAdmin()
        const postDriver = () =>
          api
            .post("/drivers", defaultDriverBody, bearer(registrationToken))
            .catch((e) => e.response)

        const pending = await postDriver()
        expect(pending.status).toBe(403)
        expect(pending.data.message).toBe(PENDING_INVITE_MESSAGE)

        const [invite] = await invitesOf(driver.id)
        await expire(invite.id)

        const expired = await postDriver()
        expect(expired.status).toBe(403)
        expect(expired.data.message).toBe(EXPIRED_INVITE_MESSAGE)
        expect(await driverService().listDrivers({ email: EMAIL })).toHaveLength(
          1
        )
      })

      it("unblocks login after a resend and leaves other emails alone", async () => {
        const driver = await createDriverAsAdmin()
        const [invite] = await invitesOf(driver.id)
        await expire(invite.id)
        expect((await resend(driver.id)).status).toBe(201)

        expect((await login()).data.message).toBe(PENDING_INVITE_MESSAGE)
        await accept({ token: await latestToken(), password: PASSWORD })

        expect((await login()).status).toBe(200)
        const unknown = await login("nobody@test.com", "whatever")
        expect(unknown.status).toBe(401)
      })
    })

    describe("POST /admin/drivers/:id/resend-invite", () => {
      it("creates a new invitation (201) and revokes the previous one", async () => {
        const driver = await createDriverAsAdmin()
        const firstToken = await latestToken()

        const res = await resend(driver.id)

        expect(res.status).toBe(201)
        expect(res.data.driver).toEqual(
          expect.objectContaining({ id: driver.id, email: EMAIL })
        )
        expect(await inviteNotifications()).toHaveLength(2)
        const secondToken = await latestToken()
        expect(secondToken).not.toBe(firstToken)
        expect((await invitesOf(driver.id)).map((i) => i.status)).toEqual([
          "revoked",
          "pending",
        ])

        const old = await accept({ token: firstToken, password: PASSWORD })
        expect(old.status).toBe(410)
        expect(old.data.message).toBe(REPLACED_LINK_MESSAGE)

        const fresh = await accept({ token: secondToken, password: PASSWORD })
        expect(fresh.status).toBe(200)
        expect((await login()).status).toBe(200)

        // A replaced link stays unusable after the new one is used.
        const oldAgain = await accept({ token: firstToken, password: PASSWORD })
        expect(oldAgain.status).toBe(410)
      })

      it("replaces an expired invitation with a new 7-day one; the old link never works again", async () => {
        const driver = await createDriverAsAdmin()
        const oldToken = await latestToken()
        const [invite] = await invitesOf(driver.id)
        await expire(invite.id)

        expect((await resend(driver.id)).status).toBe(201)

        const [old, renewed] = await invitesOf(driver.id)
        expect(old.status).toBe("expired")
        expect(renewed.status).toBe("pending")
        expect(new Date(renewed.expires_at).getTime()).toBeGreaterThan(
          Date.now() + 6 * DAY_MS
        )

        const oldRes = await accept({ token: oldToken, password: PASSWORD })
        expect(oldRes.status).toBe(410)
        expect(oldRes.data.message).toBe(EXPIRED_LINK_MESSAGE)

        const res = await accept({
          token: await latestToken(),
          password: PASSWORD,
        })
        expect(res.status).toBe(200)
      })

      it("refuses a resend that loses the race to an acceptance (409), sending nothing", async () => {
        const driver = await createDriverAsAdmin()
        const token = await latestToken()

        // Pause the resend after its early checks passed, right before it
        // issues the new invitation.
        const service = driverService()
        const issue = service.issueDriverInvite.bind(service)
        const issueReached = deferred()
        const resumeIssue = deferred()
        const spy = jest
          .spyOn(service, "issueDriverInvite")
          .mockImplementation((async (...args: any[]) => {
            issueReached.resolve()
            await resumeIssue.promise
            return (issue as any)(...args)
          }) as any)

        try {
          const resendReq = resend(driver.id)
          await issueReached.promise

          const acceptRes = await accept({ token, password: PASSWORD })
          expect(acceptRes.status).toBe(200)

          resumeIssue.resolve()
          const resendRes = await resendReq

          expect(resendRes.status).toBe(409)
          expect(resendRes.data.message).toBe(HAS_LOGIN_MESSAGE)
        } finally {
          spy.mockRestore()
        }

        expect(await inviteNotifications()).toHaveLength(1)
        expect((await invitesOf(driver.id)).map((i) => i.status)).toEqual([
          "accepted",
        ])
        expect((await login()).status).toBe(200)
      })

      it("rejects an acceptance that loses the race to a resend (410), creating no login", async () => {
        const driver = await createDriverAsAdmin()
        const oldToken = await latestToken()

        // Pause the acceptance after it validated the token, right before it
        // claims the invitation.
        const service = driverService()
        const claim = service.acceptPendingDriverInvite.bind(service)
        const claimReached = deferred()
        const resumeClaim = deferred()
        const spy = jest
          .spyOn(service, "acceptPendingDriverInvite")
          .mockImplementation((async (...args: any[]) => {
            claimReached.resolve()
            await resumeClaim.promise
            return (claim as any)(...args)
          }) as any)

        try {
          const acceptReq = accept({ token: oldToken, password: "old-link" })
          await claimReached.promise

          expect((await resend(driver.id)).status).toBe(201)

          resumeClaim.resolve()
          const acceptRes = await acceptReq

          expect(acceptRes.status).toBe(410)
          expect(acceptRes.data.message).toBe(REPLACED_LINK_MESSAGE)
        } finally {
          spy.mockRestore()
        }

        expect(await identitiesOf()).toHaveLength(0)
        expect((await login(EMAIL, "old-link")).status).not.toBe(200)
        const fresh = await accept({
          token: await latestToken(),
          password: PASSWORD,
        })
        expect(fresh.status).toBe(200)
        expect((await login()).status).toBe(200)
      })

      it("keeps one pending invitation when resends run concurrently", async () => {
        const driver = await createDriverAsAdmin()

        const responses = await Promise.all([
          resend(driver.id),
          resend(driver.id),
          resend(driver.id),
        ])

        expect(responses.map((res) => res.status)).toEqual([201, 201, 201])
        const invites = await invitesOf(driver.id)
        expect(invites.filter((i) => i.status === "pending")).toHaveLength(1)
        expect(invites).toHaveLength(4)
      })

      it("invites a driver created before invitations existed", async () => {
        const [driver] = await driverService().createDrivers([
          { ...defaultDriverBody, vehicle_type: "car", email: EMAIL },
        ])
        expect(await invitesOf(driver.id)).toHaveLength(0)

        const res = await resend(driver.id)

        expect(res.status).toBe(201)
        expect(await inviteNotifications()).toHaveLength(1)
        const acceptRes = await accept({
          token: await latestToken(),
          password: PASSWORD,
        })
        expect(acceptRes.status).toBe(200)
        expect((await login()).status).toBe(200)
      })

      it("rejects a driver whose invitation was accepted with 409", async () => {
        const driver = await createDriverAsAdmin()
        await accept({ token: await latestToken(), password: PASSWORD })

        const res = await resend(driver.id)

        expect(res.status).toBe(409)
        expect(res.data).toEqual({ type: "conflict", message: HAS_LOGIN_MESSAGE })
        expect(await inviteNotifications()).toHaveLength(1)
      })

      it("rejects a self-registered driver with 409", async () => {
        const { driver } = await createDriver(api, { email: EMAIL })

        const res = await resend(driver.id)

        expect(res.status).toBe(409)
        expect(res.data.message).toBe(HAS_LOGIN_MESSAGE)
        expect(await inviteNotifications()).toHaveLength(0)
        expect(await invitesOf(driver.id)).toHaveLength(0)
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
