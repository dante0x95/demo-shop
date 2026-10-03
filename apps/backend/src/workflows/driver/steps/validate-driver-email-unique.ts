import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DRIVER_MODULE } from "../../../modules/driver"
import DriverModuleService from "../../../modules/driver/service"
import { driverEmailExistsError } from "../utils/driver-email-conflict"

export type ValidateDriverEmailUniqueStepInput = {
  email: string
}

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
