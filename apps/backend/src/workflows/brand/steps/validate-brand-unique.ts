import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BRAND_MODULE } from "../../../modules/brand"
import BrandModuleService from "../../../modules/brand/service"
import { brandConflictError, findBrandConflict } from "../utils/brand-conflict"

export type ValidateBrandUniqueStepInput = {
  name: string
  handle: string
  // The value the handle was generated from (explicit handle, or the name).
  handle_source: string
}

// Early, friendly check. The unique indexes on handle and lower(name) are what
// actually enforce uniqueness when requests race; see createBrandStep.
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

    const conflict = await findBrandConflict(brandModuleService, input)

    if (conflict) {
      throw brandConflictError(conflict)
    }

    return new StepResponse(undefined)
  }
)
