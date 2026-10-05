import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../modules/media"
import MediaModuleService from "../../../modules/media/service"

export type CreateMediaAssetsStepInput = {
  url: string
  file_id: string
  filename: string
  mime_type: string
  size: number
  alt?: string | null
}[]

export const createMediaAssetsStep = createStep(
  "create-media-assets",
  async (input: CreateMediaAssetsStepInput, { container }) => {
    const mediaModuleService: MediaModuleService =
      container.resolve(MEDIA_MODULE)

    const mediaAssets = await mediaModuleService.createMediaAssets(input)

    return new StepResponse(
      mediaAssets,
      mediaAssets.map((mediaAsset) => mediaAsset.id)
    )
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }

    const mediaModuleService: MediaModuleService =
      container.resolve(MEDIA_MODULE)

    await mediaModuleService.deleteMediaAssets(ids)
  }
)
