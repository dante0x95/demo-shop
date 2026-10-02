import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type ValidateMediaAssetNotInUseStepInput = {
  id: string
  url: string
}

// Product images store a copy of the asset's url, so a product image with the
// same url means the asset is still shown on that product. Read-only, so
// nothing needs compensating.
export const validateMediaAssetNotInUseStep = createStep(
  "validate-media-asset-not-in-use",
  async (input: ValidateMediaAssetNotInUseStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data: images } = await query.graph({
      entity: "product_image",
      fields: ["id", "product_id"],
      filters: { url: input.url },
    })

    if (images.length) {
      const productCount = new Set(images.map((image) => image.product_id))
        .size

      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Media asset with id: ${input.id} is used by ${productCount} product(s). Remove it from their images before deleting it`
      )
    }

    return new StepResponse(undefined)
  }
)
