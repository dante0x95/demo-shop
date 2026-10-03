import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DRIVER_MODULE } from "../../../modules/driver"
import DriverModuleService from "../../../modules/driver/service"
import { hashDriverInviteToken } from "../utils/driver-invite"

export type ValidateDriverInviteTokenStepInput = {
  token: string
}

export type ValidateDriverInviteTokenStepOutput = {
  invite_id: string
  driver: { id: string; email: string }
}

// Resolves the invitation behind an emailed token. A replaced link's token no
// longer matches any invite, so it reads as invalid.
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
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This invitation link is invalid. Ask for a new invitation."
      )
    }

    if (invite.accepted_at) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This invitation was already accepted. Log in with your email and password."
      )
    }

    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This invitation link has expired. Ask for a new invitation."
      )
    }

    return new StepResponse<ValidateDriverInviteTokenStepOutput>({
      invite_id: invite.id,
      driver: { id: invite.driver.id, email: invite.driver.email },
    })
  }
)
