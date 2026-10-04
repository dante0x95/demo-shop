import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { driverHasLoginError } from "../../../modules/driver/utils/errors"
import { DriverInviteStatus } from "../../../modules/driver/utils/invite-statuses"

export type ValidateDriverWithoutLoginStepInput = {
  driver: {
    id: string
    email: string
    invites?: ({ status: DriverInviteStatus } | null)[] | null
  }
}

// An invitation only makes sense for a driver nobody can log in as yet:
// self-registered drivers and accepted invitations already have a login.
// Early, friendly check; issueDriverInvite checks accepted invitations again
// under the driver's row lock.
export const validateDriverWithoutLoginStep = createStep(
  "validate-driver-without-login",
  async ({ driver }: ValidateDriverWithoutLoginStepInput, { container }) => {
    if (driver.invites?.some((invite) => invite?.status === "accepted")) {
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
