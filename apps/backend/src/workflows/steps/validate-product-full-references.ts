import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type ValidateProductFullReferencesStepInput = {
  media_asset_ids: string[]
  location_ids: string[]
}

// Media urls by asset id, for building the product's images and thumbnail.
export type MediaAssetUrls = Record<string, string>

// Checks the references the request makes outside the product module before
// anything is written, so an unknown one is a 400 rather than a rollback.
// Core `validateInventoryLocationsStep` would throw NOT_FOUND (404) instead.
// The brand is checked by the `productsCreated` hook. Read-only, so nothing
// needs compensating.
export const validateProductFullReferencesStep = createStep(
  "validate-product-full-references",
  async (input: ValidateProductFullReferencesStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const mediaAssetIds = [...new Set(input.media_asset_ids)]
    const locationIds = [...new Set(input.location_ids)]

    const [{ data: mediaAssets }, { data: locations }] = await Promise.all([
      mediaAssetIds.length
        ? query.graph({
            entity: "media_asset",
            fields: ["id", "url"],
            filters: { id: mediaAssetIds },
          })
        : { data: [] },
      locationIds.length
        ? query.graph({
            entity: "stock_location",
            fields: ["id"],
            filters: { id: locationIds },
          })
        : { data: [] },
    ])

    const urls: MediaAssetUrls = Object.fromEntries(
      mediaAssets.map((asset) => [asset.id, asset.url])
    )

    const missingMedia = mediaAssetIds.filter((id) => !urls[id])

    if (missingMedia.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Media assets with ids: ${missingMedia.join(", ")} were not found`
      )
    }

    const foundLocations = new Set(locations.map((location) => location.id))
    const missingLocations = locationIds.filter(
      (id) => !foundLocations.has(id)
    )

    if (missingLocations.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Stock locations with ids: ${missingLocations.join(", ")} were not found`
      )
    }

    return new StepResponse(urls)
  }
)
