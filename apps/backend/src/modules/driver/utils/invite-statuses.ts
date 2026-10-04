// The life of a driver invitation (T14.2):
// - pending: emailed, not used yet. At most one per driver.
// - accepted: the driver set their password through it.
// - revoked: replaced by a newer invitation before it expired.
// - expired: replaced, or found unused, after its expires_at.
// A pending invitation past its expires_at counts as expired before the
// column says so (see getDriverInviteStatus in the driver workflows).
export const DRIVER_INVITE_STATUSES = [
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const

export type DriverInviteStatus = (typeof DRIVER_INVITE_STATUSES)[number]
