import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../modules/media"
import MediaModuleService from "../../../modules/media/service"

export const deleteMediaAssetStep = createStep(
  "delete-media-asset",
  async (id: string, { container }) => {
    const mediaModuleService: MediaModuleService =
      container.resolve(MEDIA_MODULE)

    await mediaModuleService.softDeleteMediaAssets(id)

    return new StepResponse(undefined, id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const mediaModuleService: MediaModuleService =
      container.resolve(MEDIA_MODULE)

    await mediaModuleService.restoreMediaAssets(id)
  }
)
