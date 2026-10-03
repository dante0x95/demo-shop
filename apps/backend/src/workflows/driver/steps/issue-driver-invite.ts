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

type PreviousInvite = {
  id: string
  token_hash: string
  expires_at: Date
  accepted_at: Date | null
}

type CompensationData = { created_id: string } | { previous: PreviousInvite }

// Creates the driver's invitation, or rotates the existing one: a new token
// and a new 7-day window. The old token no longer matches, so its link is dead.
export const issueDriverInviteStep = createStep(
  "issue-driver-invite",
  async ({ driver_id }: IssueDriverInviteStepInput, { container }) => {
    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    const token = generateDriverInviteToken()
    const data = {
      token_hash: hashDriverInviteToken(token),
      expires_at: new Date(Date.now() + DRIVER_INVITE_TTL_MS),
      accepted_at: null,
    }

    const findExisting = async (): Promise<PreviousInvite | undefined> => {
      const [existing] = await driverModuleService.listDriverInvites(
        { driver_id },
        { select: ["id", "token_hash", "expires_at", "accepted_at"], take: 1 }
      )

      return existing
        ? {
            id: existing.id,
            token_hash: existing.token_hash,
            expires_at: existing.expires_at,
            accepted_at: existing.accepted_at ?? null,
          }
        : undefined
    }

    let previous = await findExisting()
    let inviteId = ""
    let compensation: CompensationData | undefined

    if (!previous) {
      try {
        const invite = await driverModuleService.createDriverInvites({
          ...data,
          driver_id,
        })
        inviteId = invite.id
        compensation = { created_id: invite.id }
      } catch (error) {
        // A concurrent request created the invite first (unique driver_id):
        // rotate that one instead.
        previous = await findExisting()

        if (!previous) {
          throw error
        }
      }
    }

    if (previous) {
      await driverModuleService.updateDriverInvites({ id: previous.id, ...data })
      inviteId = previous.id
      compensation = { previous }
    }

    return new StepResponse<IssueDriverInviteStepOutput, CompensationData>(
      { invite_id: inviteId, token, expires_at: data.expires_at },
      compensation
    )
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }

    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    if ("created_id" in compensation) {
      await driverModuleService.deleteDriverInvites(compensation.created_id)
      return
    }

    await driverModuleService.updateDriverInvites(compensation.previous)
  }
)
