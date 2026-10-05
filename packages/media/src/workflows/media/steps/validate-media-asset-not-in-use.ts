import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type ValidateMediaAssetNotInUseStepInput = {
  id: string
  url: string
}

// Products store a copy of the asset's url in three independent places: their
// images, their thumbnail and their variants' thumbnails. A match in any of
// them means the asset is still shown on that product. Read-only, so nothing
// needs compensating.
export const validateMediaAssetNotInUseStep = createStep(
  "validate-media-asset-not-in-use",
  async (input: ValidateMediaAssetNotInUseStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const [{ data: images }, { data: products }, { data: variants }] =
      await Promise.all([
        query.graph({
          entity: "product_image",
          fields: ["product_id"],
          filters: { url: input.url },
        }),
        query.graph({
          entity: "product",
          fields: ["id"],
          filters: { thumbnail: input.url },
        }),
        query.graph({
          entity: "product_variant",
          fields: ["product_id"],
          filters: { thumbnail: input.url },
        }),
      ])

    // One product can use the asset in several places; count it once.
    const productIds = new Set([
      ...images.map((image) => image.product_id),
      ...products.map((product) => product.id),
      ...variants.map((variant) => variant.product_id),
    ])

    if (productIds.size) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Media asset with id: ${input.id} is used by ${productIds.size} product(s). Remove it from their images and thumbnails before deleting it`
      )
    }

    return new StepResponse(undefined)
  }
)
