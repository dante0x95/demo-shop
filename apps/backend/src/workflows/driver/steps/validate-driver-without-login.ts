import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type ValidateDriverWithoutLoginStepInput = {
  driver: {
    id: string
    email: string
    invite?: { accepted_at?: Date | string | null } | null
  }
}

export const driverHasLoginError = () =>
  new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    "This driver already has a login"
  )

// An invitation only makes sense for a driver nobody can log in as yet:
// self-registered drivers and accepted invitations already have a login.
export const validateDriverWithoutLoginStep = createStep(
  "validate-driver-without-login",
  async ({ driver }: ValidateDriverWithoutLoginStepInput, { container }) => {
    if (driver.invite?.accepted_at) {
      throw driverHasLoginError()
    }

    const authModuleService = container.resolve(Modules.AUTH)

    // A driver's login is the emailpass identity whose entity_id is the
    // driver's email, linked through app_metadata.driver_id.
    const providerIdentities = await authModuleService.listProviderIdentities(
      { provider: "emailpass", entity_id: driver.email },
      { relations: ["auth_identity"] }
    )

    const hasLogin = providerIdentities.some(
      (identity) => identity.auth_identity?.app_metadata?.driver_id === driver.id
    )

    if (hasLogin) {
      throw driverHasLoginError()
    }

    return new StepResponse(undefined)
  }
)
