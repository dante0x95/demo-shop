import path from "path"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { DRIVER_MODULE } from ".."
import Driver from "../models/driver"
import DriverInvite from "../models/driver-invite"
import DriverModuleService from "../service"

jest.setTimeout(60 * 1000)

const NOW = new Date("2026-10-03T12:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000
const LATER = new Date(NOW.getTime() + 7 * DAY_MS)

const driverData = (email: string) => ({
  first_name: "Ana",
  last_name: "Lopez",
  email,
  phone: "+52 55 1234 5678",
  vehicle_type: "motorcycle" as const,
})

// Runs the module's real migrations so the one-pending-invite-per-driver index
// is the one shipped, not one derived from the models.
moduleIntegrationTestRunner<DriverModuleService>({
  moduleName: DRIVER_MODULE,
  moduleModels: [Driver, DriverInvite],
  resolve: path.join(__dirname, ".."),
  pathToMigrations: path.join(__dirname, "../migrations"),
  testSuite: ({ service }) => {
    let driverId: string
    let counter = 0

    const issue = (
      overrides: Partial<{ expires_at: Date; now: Date; driver_id: string }> = {}
    ) =>
      service.issueDriverInvite({
        driver_id: driverId,
        token_hash: `hash-${++counter}`,
        expires_at: LATER,
        now: NOW,
        ...overrides,
      })

    const statusOf = async (id: string) =>
      (await service.retrieveDriverInvite(id)).status

    beforeEach(async () => {
      const driver = await service.createDrivers(
        driverData(`driver-${++counter}@test.com`)
      )
      driverId = driver.id
    })

    describe("issueDriverInvite", () => {
      it("creates a pending invitation for a driver without one", async () => {
        const { invite, replaced_ids } = await issue()

        expect(replaced_ids).toEqual([])
        const stored = await service.retrieveDriverInvite(invite.id)
        expect(stored).toEqual(
          expect.objectContaining({
            driver_id: driverId,
            status: "pending",
            accepted_at: null,
          })
        )
        expect(new Date(stored.expires_at).toISOString()).toBe(
          LATER.toISOString()
        )
      })

      it("revokes the pending invitation it replaces and keeps both rows", async () => {
        const first = await issue()

        const second = await issue()

        expect(second.replaced_ids).toEqual([first.invite.id])
        expect(await statusOf(first.invite.id)).toBe("revoked")
        expect(await statusOf(second.invite.id)).toBe("pending")
        expect(
          await service.listDriverInvites({ driver_id: driverId })
        ).toHaveLength(2)
      })

      it("marks a replaced invitation past its expires_at as expired", async () => {
        const first = await issue({ expires_at: NOW })

        await issue({ now: NOW })

        expect(await statusOf(first.invite.id)).toBe("expired")
      })

      it("never touches invitations that are not pending", async () => {
        const first = await issue()
        await issue()
        const third = await issue()

        expect(await statusOf(first.invite.id)).toBe("revoked")
        expect(third.replaced_ids).toHaveLength(1)
      })

      it("keeps one pending invitation under concurrent calls", async () => {
        const results = await Promise.all([issue(), issue(), issue()])

        const pending = await service.listDriverInvites({
          driver_id: driverId,
          status: "pending",
        })
        expect(pending).toHaveLength(1)
        expect(results.map((r) => r.invite.id)).toContain(pending[0].id)
        expect(
          await service.listDriverInvites({ driver_id: driverId })
        ).toHaveLength(3)
      })

      it("refuses a driver who already accepted an invitation, changing nothing", async () => {
        const { invite } = await issue()
        expect(await service.acceptPendingDriverInvite(invite.id, NOW)).toBe(
          true
        )

        await expect(issue()).rejects.toThrow("This driver already has a login")

        const invites = await service.listDriverInvites({ driver_id: driverId })
        expect(invites.map((i) => i.status)).toEqual(["accepted"])
      })

      it("returns 404 for an unknown driver", async () => {
        await expect(issue({ driver_id: "drv_unknown" })).rejects.toThrow(
          "Driver with id: drv_unknown was not found"
        )
      })

      it("rejects a second pending invitation written directly", async () => {
        await issue()

        await expect(
          service.createDriverInvites({
            driver_id: driverId,
            token_hash: "direct",
            expires_at: LATER,
          })
        ).rejects.toThrow()
      })
    })

    describe("acceptPendingDriverInvite", () => {
      it("accepts a pending, unexpired invitation once", async () => {
        const { invite } = await issue()

        expect(await service.acceptPendingDriverInvite(invite.id, NOW)).toBe(
          true
        )

        const stored = await service.retrieveDriverInvite(invite.id)
        expect(stored.status).toBe("accepted")
        expect(new Date(stored.accepted_at!).toISOString()).toBe(
          NOW.toISOString()
        )
        expect(await service.acceptPendingDriverInvite(invite.id, NOW)).toBe(
          false
        )
      })

      it("refuses an invitation at or past its expires_at", async () => {
        const { invite } = await issue({ expires_at: NOW })

        expect(await service.acceptPendingDriverInvite(invite.id, NOW)).toBe(
          false
        )
        expect(await statusOf(invite.id)).toBe("pending")
      })

      it("refuses a revoked invitation", async () => {
        const first = await issue()
        await issue()

        expect(
          await service.acceptPendingDriverInvite(first.invite.id, NOW)
        ).toBe(false)
        expect(await statusOf(first.invite.id)).toBe("revoked")
      })

      it("lets only one of two concurrent acceptances win", async () => {
        const { invite } = await issue()

        const results = await Promise.all([
          service.acceptPendingDriverInvite(invite.id, NOW),
          service.acceptPendingDriverInvite(invite.id, NOW),
        ])

        expect(results.filter(Boolean)).toHaveLength(1)
      })
    })
  },
})
