import { MedusaError } from "@medusajs/framework/utils"

// Medusa links a login (auth identity) to the actors it belongs to through
// app_metadata keys named `<actor type>_id`: user_id (admin), customer_id,
// driver_id. One emailpass login exists per email, whatever the actor type.
const ACTOR_ID_KEY = /^[a-z][a-z0-9_]*_id$/

export type DriverLoginOwner = "none" | "driver" | "other"

// Who the login of an email belongs to, seen from the driver `driverId`:
// - "none": no role is linked (e.g. a driver sign-up that stopped before
//   POST /drivers). Decided in T14.2: the invited driver takes it over.
// - "driver": it is already this driver's login.
// - "other": an admin, a customer or another driver uses it. Decided in
//   T14.2: logins are never shared.
// Without `driverId` (the driver doesn't exist yet), any linked role is
// "other".
export const getDriverLoginOwner = (
  appMetadata: Record<string, unknown> | null | undefined,
  driverId?: string
): DriverLoginOwner => {
  const linked = Object.entries(appMetadata ?? {}).filter(
    ([key, value]) => ACTOR_ID_KEY.test(key) && !!value
  )

  if (
    linked.some(([key, value]) => !(key === "driver_id" && value === driverId))
  ) {
    return "other"
  }

  return linked.length ? "driver" : "none"
}

// 409; the routes keep the message.
export const emailUsedByAnotherAccountError = () =>
  new MedusaError(
    MedusaError.Types.CONFLICT,
    "This email is already used by another account"
  )
