import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DRIVER_MODULE } from "../../../modules/driver"
import DriverModuleService from "../../../modules/driver/service"
import {
  driverInviteNotFoundError,
  driverInviteUnusableError,
  getDriverInviteStatus,
  hashDriverInviteToken,
} from "../utils/driver-invite"

export type ValidateDriverInviteTokenStepInput = {
  token: string
}

export type ValidateDriverInviteTokenStepOutput = {
  invite_id: string
  driver: { id: string; email: string }
}

// Resolves the invitation behind an emailed token and checks, from its stored
// record, that it can still be used: unknown link 404, already accepted 409,
// expired, revoked or replaced 410.
export const validateDriverInviteTokenStep = createStep(
  "validate-driver-invite-token",
  async ({ token }: ValidateDriverInviteTokenStepInput, { container }) => {
    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    const [invite] = await driverModuleService.listDriverInvites(
      { token_hash: hashDriverInviteToken(token) },
      { relations: ["driver"], take: 1 }
    )

    if (!invite?.driver) {
      throw driverInviteNotFoundError()
    }

    const error = driverInviteUnusableError(
      getDriverInviteStatus(invite, new Date())
    )

    if (error) {
      throw error
    }

    return new StepResponse<ValidateDriverInviteTokenStepOutput>({
      invite_id: invite.id,
      driver: { id: invite.driver.id, email: invite.driver.email },
    })
  }
)
