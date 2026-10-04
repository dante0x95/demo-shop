import { MedusaError } from "@medusajs/framework/utils"

// A driver who can already log in (self-registered, or an accepted
// invitation) gets no new invitation. 409; the routes keep the message.
export const driverHasLoginError = () =>
  new MedusaError(
    MedusaError.Types.CONFLICT,
    "This driver already has a login"
  )
