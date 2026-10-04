import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DRIVER_MODULE } from "../../../modules/driver"
import DriverModuleService from "../../../modules/driver/service"
import {
  DRIVER_INVITE_TTL_MS,
  generateDriverInviteToken,
  hashDriverInviteToken,
} from "../utils/driver-invite"

export type IssueDriverInviteStepInput = {
  driver_id: string
}

export type IssueDriverInviteStepOutput = {
  invite_id: string
  // Plain token for the email. Only its hash is stored.
  token: string
  expires_at: Date
}

type CompensationData = {
  created_id: string
  replaced_ids: string[]
}

// Adds a new pending invitation with its own 7-day window. The pending one it
// replaces is revoked (or expired, if its window had passed), so its link
// stays dead even after this one is used or expires.
export const issueDriverInviteStep = createStep(
  "issue-driver-invite",
  async ({ driver_id }: IssueDriverInviteStepInput, { container }) => {
    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    const token = generateDriverInviteToken()
    const now = new Date()

    const { invite, replaced_ids } =
      await driverModuleService.issueDriverInvite({
        driver_id,
        token_hash: hashDriverInviteToken(token),
        expires_at: new Date(now.getTime() + DRIVER_INVITE_TTL_MS),
        now,
      })

    return new StepResponse<IssueDriverInviteStepOutput, CompensationData>(
      { invite_id: invite.id, token, expires_at: invite.expires_at },
      { created_id: invite.id, replaced_ids }
    )
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }

    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    // The new link was never emailed: drop it and give back the one it
    // replaced (first, so one pending invitation per driver still holds).
    await driverModuleService.deleteDriverInvites(compensation.created_id)

    if (compensation.replaced_ids.length) {
      await driverModuleService.updateDriverInvites(
        compensation.replaced_ids.map((id) => ({ id, status: "pending" as const }))
      )
    }
  }
)
