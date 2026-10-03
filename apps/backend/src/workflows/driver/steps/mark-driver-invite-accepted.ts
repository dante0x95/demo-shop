import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DRIVER_MODULE } from "../../../modules/driver"
import DriverModuleService from "../../../modules/driver/service"

export type MarkDriverInviteAcceptedStepInput = {
  id: string
}

export const markDriverInviteAcceptedStep = createStep(
  "mark-driver-invite-accepted",
  async ({ id }: MarkDriverInviteAcceptedStepInput, { container }) => {
    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    const invite = await driverModuleService.updateDriverInvites({
      id,
      accepted_at: new Date(),
    })

    return new StepResponse(invite, id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    await driverModuleService.updateDriverInvites({ id, accepted_at: null })
  }
)
