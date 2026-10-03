import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DRIVER_MODULE } from "../../../modules/driver"
import DriverModuleService from "../../../modules/driver/service"

export type ValidateDriverEmailUniqueStepInput = {
  email: string
}

export const driverEmailExistsError = () =>
  new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "A driver with this email already exists"
  )

// Early, friendly check. The unique index on email is what actually enforces
// uniqueness when requests race; see createDriverStep.
export const validateDriverEmailUniqueStep = createStep(
  "validate-driver-email-unique",
  async ({ email }: ValidateDriverEmailUniqueStepInput, { container }) => {
    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    const [existing] = await driverModuleService.listDrivers(
      { email },
      { select: ["id"], take: 1 }
    )

    if (existing) {
      throw driverEmailExistsError()
    }

    return new StepResponse(undefined)
  }
)
