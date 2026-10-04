import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  emailUsedByAnotherAccountError,
  getDriverLoginOwner,
} from "../utils/driver-login"

export type ValidateDriverEmailAvailableStepInput = {
  email: string
}

// Decided in T14.2: no shared logins. A new driver can't use an email whose
// login an admin or a customer already has (409). A login with no role linked
// (an abandoned driver sign-up) is fine: accepting the invitation takes it
// over. Accepting checks again (setDriverPasswordStep).
export const validateDriverEmailAvailableStep = createStep(
  "validate-driver-email-available",
  async ({ email }: ValidateDriverEmailAvailableStepInput, { container }) => {
    const authModuleService = container.resolve(Modules.AUTH)

    const [existing] = await authModuleService.listProviderIdentities(
      { provider: "emailpass", entity_id: email },
      { relations: ["auth_identity"], take: 1 }
    )

    if (
      existing &&
      getDriverLoginOwner(existing.auth_identity?.app_metadata) !== "none"
    ) {
      throw emailUsedByAnotherAccountError()
    }

    return new StepResponse(undefined)
  }
)
