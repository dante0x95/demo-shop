import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type ValidateDriverActiveStepInput = {
  driver?: { id: string; is_active: boolean } | null
}

// Gate for the actions a driver takes on their orders (confirm delivery,
// collect payment): a deactivated driver keeps their token and their
// assigned orders, but can't act on them. Read-only, so nothing needs
// compensating.
export const validateDriverActiveStep = createStep(
  "validate-driver-active",
  async ({ driver }: ValidateDriverActiveStepInput) => {
    // The token can outlive its driver (e.g. a soft-deleted driver).
    if (!driver) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Driver not found")
    }

    if (!driver.is_active) {
      throw new MedusaError(
        MedusaError.Types.FORBIDDEN,
        "Driver is inactive"
      )
    }

    return new StepResponse(undefined)
  }
)
