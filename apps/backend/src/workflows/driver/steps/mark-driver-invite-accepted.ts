import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DRIVER_MODULE } from "../../../modules/driver"
import DriverModuleService from "../../../modules/driver/service"
import {
  driverInviteUnusableError,
  getDriverInviteStatus,
} from "../utils/driver-invite"

export type MarkDriverInviteAcceptedStepInput = {
  id: string
}

// Claims the invitation with one conditional update (pending and not expired
// at this moment). If a resend, an expiry or another acceptance got there
// first, explains which with the same errors as validateDriverInviteTokenStep.
export const markDriverInviteAcceptedStep = createStep(
  "mark-driver-invite-accepted",
  async ({ id }: MarkDriverInviteAcceptedStepInput, { container }) => {
    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    const now = new Date()
    const accepted = await driverModuleService.acceptPendingDriverInvite(
      id,
      now
    )

    if (!accepted) {
      const invite = await driverModuleService.retrieveDriverInvite(id, {
        select: ["id", "status", "expires_at"],
      })

      throw (
        driverInviteUnusableError(getDriverInviteStatus(invite, now)) ??
        new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Could not accept the invitation"
        )
      )
    }

    return new StepResponse(undefined, id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    await driverModuleService.updateDriverInvites({
      id,
      status: "pending",
      accepted_at: null,
    })
  }
)
