import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BRAND_MODULE } from "../../../modules/brand"
import BrandModuleService from "../../../modules/brand/service"

export type ValidateBrandUniqueStepInput = {
  name: string
  handle: string
  // The value the handle was generated from (explicit handle, or the name).
  handle_source: string
}

// Escape LIKE wildcards so $ilike matches the name literally, ignoring case only.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

export const validateBrandUniqueStep = createStep(
  "validate-brand-unique",
  async (input: ValidateBrandUniqueStepInput, { container }) => {
    // Without a letter or digit, toHandle falls back to a random "product-xxxxxx" handle.
    if (!/[\p{L}\p{N}]/u.test(input.handle_source)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Brand handle must contain at least one letter or digit"
      )
    }

    const brandModuleService: BrandModuleService =
      container.resolve(BRAND_MODULE)

    const existing = await brandModuleService.listBrands(
      {
        $or: [
          { name: { $ilike: escapeLike(input.name) } },
          { handle: input.handle },
        ],
      },
      { select: ["id", "name", "handle"], take: 1 }
    )

    if (existing.length) {
      // A same-name brand also has the same generated handle; report the name.
      const field =
        existing[0].name.toLowerCase() === input.name.toLowerCase()
          ? "name"
          : "handle"
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `A brand with this ${field} already exists`
      )
    }

    return new StepResponse(undefined)
  }
)
