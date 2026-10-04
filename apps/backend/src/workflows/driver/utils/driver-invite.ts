import { createHash, randomBytes } from "crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { DriverInviteStatus } from "../../../modules/driver/utils/invite-statuses"

// Decided in T14.1: an invitation link is valid for 7 days.
export const DRIVER_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const DRIVER_INVITE_NOTIFICATION_CHANNEL = "email"
export const DRIVER_INVITE_NOTIFICATION_TEMPLATE = "driver-invite"

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

export type DriverInviteState = {
  status: DriverInviteStatus
  expires_at: Date | string
}

// The invitation's status at `now`. The stored status alone is not enough: a
// pending invitation whose expires_at has passed is expired, whatever the
// column says, and never becomes valid again.
export const getDriverInviteStatus = (
  invite: DriverInviteState,
  now: Date
): DriverInviteStatus => {
  if (
    invite.status === "pending" &&
    new Date(invite.expires_at).getTime() <= now.getTime()
  ) {
    return "expired"
  }

  return invite.status
}

export type DriverInviteGate = "pending" | "expired"

// Whether a driver's invitations block logging in or signing up with their
// email, and why:
// - "pending": an unused, unexpired link is waiting in their inbox;
// - "expired": every link they got expired or was replaced, and none was used;
//   only the store can send a new one.
// No invitations (self-registered, or created before T14.1) or an accepted
// one: nothing blocks them.
export const getDriverInviteGate = (
  invites: (DriverInviteState | null | undefined)[] | null | undefined,
  now: Date
): DriverInviteGate | null => {
  const statuses = (invites ?? [])
    .filter((invite): invite is DriverInviteState => !!invite)
    .map((invite) => getDriverInviteStatus(invite, now))

  if (!statuses.length || statuses.includes("accepted")) {
    return null
  }

  return statuses.includes("pending") ? "pending" : "expired"
}

// Login, sign-up and POST /drivers while the driver created by an admin has
// not accepted their invitation (403).
export const driverInvitePendingError = () =>
  new MedusaError(
    MedusaError.Types.FORBIDDEN,
    "This email has a pending driver invitation. Check your email for the invitation link to set your password."
  )

export const driverInviteExpiredError = () =>
  new MedusaError(
    MedusaError.Types.FORBIDDEN,
    "Your driver invitation expired. Ask the store for a new one."
  )

export const driverInviteGateError = (gate: DriverInviteGate) =>
  gate === "pending" ? driverInvitePendingError() : driverInviteExpiredError()

// Accepting with a token that matches no invitation (404).
export const driverInviteNotFoundError = () =>
  new MedusaError(
    MedusaError.Types.NOT_FOUND,
    "This invitation link is invalid. Ask the store for a new invitation."
  )

// Routes answer errors with this code with 410 Gone: Medusa has no error type
// for it. The code survives the workflow engine's error serialization.
export const DRIVER_INVITE_GONE_CODE = "driver_invite_gone"

// Accepting an expired, revoked or replaced link (410).
export const driverInviteGoneError = (status: "expired" | "revoked") =>
  new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    status === "expired"
      ? "This invitation link has expired. Ask the store for a new invitation."
      : "This invitation link was replaced by a newer one. Use the link in the latest invitation email.",
    DRIVER_INVITE_GONE_CODE
  )

// Accepting a link twice (409; the route keeps the message).
export const driverInviteAcceptedError = () =>
  new MedusaError(
    MedusaError.Types.CONFLICT,
    "This invitation was already accepted. Log in with your email and password."
  )

// The error a used, expired, revoked or replaced invitation gives on accept.
export const driverInviteUnusableError = (status: DriverInviteStatus) =>
  status === "accepted"
    ? driverInviteAcceptedError()
    : status === "pending"
      ? undefined
      : driverInviteGoneError(status)
