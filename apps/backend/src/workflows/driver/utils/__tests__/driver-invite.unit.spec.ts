import { MedusaError } from "@medusajs/framework/utils"
import {
  DRIVER_INVITE_GONE_CODE,
  driverInviteGateError,
  driverInviteUnusableError,
  getDriverInviteGate,
  getDriverInviteStatus,
} from "../driver-invite"

const NOW = new Date("2026-10-03T12:00:00.000Z")
const BEFORE = new Date("2026-10-03T11:59:59.999Z")
const AFTER = new Date("2026-10-03T12:00:00.001Z")

describe("getDriverInviteStatus", () => {
  it("keeps a pending invitation pending until its expires_at", () => {
    expect(getDriverInviteStatus({ status: "pending", expires_at: AFTER }, NOW))
      .toBe("pending")
  })

  it("reads a pending invitation as expired exactly at its expires_at", () => {
    expect(getDriverInviteStatus({ status: "pending", expires_at: NOW }, NOW))
      .toBe("expired")
  })

  it("reads a pending invitation past its expires_at as expired", () => {
    expect(
      getDriverInviteStatus({ status: "pending", expires_at: BEFORE }, NOW)
    ).toBe("expired")
  })

  it("accepts expires_at as an ISO string, as query results return it", () => {
    expect(
      getDriverInviteStatus(
        { status: "pending", expires_at: BEFORE.toISOString() },
        NOW
      )
    ).toBe("expired")
  })

  it.each(["accepted", "revoked", "expired"] as const)(
    "keeps a %s invitation %s whatever its expires_at",
    (status) => {
      expect(getDriverInviteStatus({ status, expires_at: AFTER }, NOW)).toBe(
        status
      )
      expect(getDriverInviteStatus({ status, expires_at: BEFORE }, NOW)).toBe(
        status
      )
    }
  )
})

describe("getDriverInviteGate", () => {
  it("lets a driver without invitations through", () => {
    expect(getDriverInviteGate([], NOW)).toBeNull()
    expect(getDriverInviteGate(undefined, NOW)).toBeNull()
    expect(getDriverInviteGate(null, NOW)).toBeNull()
  })

  it("blocks with 'pending' while a valid link is waiting", () => {
    expect(
      getDriverInviteGate([{ status: "pending", expires_at: AFTER }], NOW)
    ).toBe("pending")
  })

  it("blocks with 'pending' when an earlier link was replaced by a valid one", () => {
    expect(
      getDriverInviteGate(
        [
          { status: "revoked", expires_at: AFTER },
          { status: "pending", expires_at: AFTER },
        ],
        NOW
      )
    ).toBe("pending")
  })

  it("blocks with 'expired' once the only link has passed its expires_at", () => {
    expect(
      getDriverInviteGate([{ status: "pending", expires_at: BEFORE }], NOW)
    ).toBe("expired")
  })

  it("blocks with 'expired' when every link expired or was revoked", () => {
    expect(
      getDriverInviteGate(
        [
          { status: "expired", expires_at: BEFORE },
          { status: "revoked", expires_at: AFTER },
        ],
        NOW
      )
    ).toBe("expired")
  })

  it("lets the driver through once any invitation was accepted", () => {
    expect(
      getDriverInviteGate(
        [
          { status: "revoked", expires_at: AFTER },
          { status: "accepted", expires_at: BEFORE },
        ],
        NOW
      )
    ).toBeNull()
  })

  it("ignores missing entries from a query result", () => {
    expect(
      getDriverInviteGate([null, { status: "pending", expires_at: AFTER }], NOW)
    ).toBe("pending")
    expect(getDriverInviteGate([null, undefined], NOW)).toBeNull()
  })
})

describe("driverInviteGateError", () => {
  it("answers a pending invitation with a 403 pointing to the email", () => {
    const error = driverInviteGateError("pending")

    expect(error.type).toBe(MedusaError.Types.FORBIDDEN)
    expect(error.message).toBe(
      "This email has a pending driver invitation. Check your email for the invitation link to set your password."
    )
  })

  it("answers an expired invitation with a 403 pointing to the store", () => {
    const error = driverInviteGateError("expired")

    expect(error.type).toBe(MedusaError.Types.FORBIDDEN)
    expect(error.message).toBe(
      "Your driver invitation expired. Ask the store for a new one."
    )
  })
})

describe("driverInviteUnusableError", () => {
  it("has no error for a pending invitation", () => {
    expect(driverInviteUnusableError("pending")).toBeUndefined()
  })

  it("answers an accepted invitation with a conflict", () => {
    const error = driverInviteUnusableError("accepted")

    expect(error?.type).toBe(MedusaError.Types.CONFLICT)
    expect(error?.code).not.toBe(DRIVER_INVITE_GONE_CODE)
    expect(error?.message).toBe(
      "This invitation was already accepted. Log in with your email and password."
    )
  })

  it("marks an expired invitation as gone", () => {
    const error = driverInviteUnusableError("expired")

    expect(error?.code).toBe(DRIVER_INVITE_GONE_CODE)
    expect(error?.message).toBe(
      "This invitation link has expired. Ask the store for a new invitation."
    )
  })

  it("marks a revoked (replaced) invitation as gone", () => {
    const error = driverInviteUnusableError("revoked")

    expect(error?.code).toBe(DRIVER_INVITE_GONE_CODE)
    expect(error?.message).toBe(
      "This invitation link was replaced by a newer one. Use the link in the latest invitation email."
    )
  })
})
