import { createHash, randomBytes } from "crypto"
import { MedusaError } from "@medusajs/framework/utils"

// Decided in T14.1: an invitation link is valid for 7 days.
export const DRIVER_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const DRIVER_INVITE_NOTIFICATION_CHANNEL = "email"
export const DRIVER_INVITE_NOTIFICATION_TEMPLATE = "driver-invite"

// Serializes accepting and resending one driver's invitation.
export const driverInviteLockKey = (driverId: string) =>
  `driver-invite:${driverId}`
export const DRIVER_INVITE_LOCK_TIMEOUT_SECONDS = 10
export const DRIVER_INVITE_LOCK_TTL_SECONDS = 30

export const generateDriverInviteToken = () => randomBytes(32).toString("hex")

// Invites store only this hash, so a leaked table can't be used to accept them.
export const hashDriverInviteToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")

// Where the driver app's "set your password" page lives. The token goes in the
// `token` query parameter. Unset: the email only carries the token.
export const buildDriverInviteUrl = (token: string) => {
  const base = process.env.DRIVER_INVITE_URL?.trim()

  if (!base) {
    return null
  }

  const url = new URL(base)
  url.searchParams.set("token", token)

  return url.toString()
}

// Returned by login, registration and POST /drivers while the driver created
// by an admin has not accepted their invitation yet.
export const driverInvitePendingError = () =>
  new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    "This email has a pending driver invitation. Check your email for the invitation link to set your password."
  )

export const isDriverInvitePending = (
  invite?: { accepted_at?: Date | string | null } | null
) => !!invite && !invite.accepted_at
