import { MedusaError } from "@medusajs/framework/utils"

// Driver emails are unique (IDX_driver_email_unique). Shared by every step that
// can hit an existing email: admin creation, self-registration and the
// unique-index race in createDriverStep.
export const driverEmailExistsError = () =>
  new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "A driver with this email already exists"
  )
