import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DRIVER_MODULE } from "../../../modules/driver"
import DriverModuleService from "../../../modules/driver/service"
import { driverEmailExistsError } from "./validate-driver-email-unique"

export type ValidateDriverAccountStepInput = {
  auth_identity: {
    id: string
    app_metadata?: Record<string, unknown> | null
    provider_identities?:
      | ({ provider: string; entity_id: string } | null)[]
      | null
  }
}

export const driverAccountExistsError = () =>
  new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "A driver account already exists for this identity"
  )

// Returns the email the driver registered with. Checked here because the core
// setAuthAppMetadataStep throws a plain Error (500) when driver_id is already set.
export const validateDriverAccountStep = createStep(
  "validate-driver-account",
  async ({ auth_identity }: ValidateDriverAccountStepInput, { container }) => {
    if (auth_identity.app_metadata?.driver_id) {
      throw driverAccountExistsError()
    }

    const email = auth_identity.provider_identities?.find(
      (identity) => identity?.provider === "emailpass"
    )?.entity_id

    if (!email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Drivers must register with email and password"
      )
    }

    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    const [existing] = await driverModuleService.listDrivers(
      { email },
      { select: ["id"], take: 1 }
    )

    // An admin may have created a driver with this email (POST /admin/drivers).
    if (existing) {
      throw driverEmailExistsError()
    }

    return new StepResponse(email)
  }
)
