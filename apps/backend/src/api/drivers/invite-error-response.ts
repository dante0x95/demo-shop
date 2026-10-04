import { MedusaError } from "@medusajs/framework/utils"
import { DRIVER_INVITE_GONE_CODE } from "../../workflows/driver/utils/driver-invite"

export type DriverInviteErrorResponse = {
  status: 409 | 410
  body: { type: string; message: string }
}

// The driver invitation statuses Medusa's error handler can't send (T14.2):
// - 410 for an expired, revoked or replaced link: no MedusaError type maps to
//   it, so those errors carry DRIVER_INVITE_GONE_CODE;
// - 409 with its message: the handler replaces every CONFLICT message with a
//   generic idempotency hint.
// Anything else returns undefined and goes to the error handler as usual.
export const getDriverInviteErrorResponse = (
  error: unknown
): DriverInviteErrorResponse | undefined => {
  const { type, code, message } = (error ?? {}) as Partial<MedusaError>

  if (typeof type !== "string" || typeof message !== "string") {
    return undefined
  }

  if (code === DRIVER_INVITE_GONE_CODE) {
    return { status: 410, body: { type, message } }
  }

  if (type === MedusaError.Types.CONFLICT) {
    return { status: 409, body: { type, message } }
  }

  return undefined
}
