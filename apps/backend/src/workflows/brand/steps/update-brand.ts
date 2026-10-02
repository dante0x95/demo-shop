import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BRAND_MODULE } from "../../../modules/brand"
import BrandModuleService from "../../../modules/brand/service"
import { brandConflictError, findBrandConflict } from "../utils/brand-conflict"

export type UpdateBrandStepInput = {
  id: string
  name?: string
  handle?: string
  description?: string | null
  logo_url?: string | null
  banner_url?: string | null
  is_active?: boolean
  metadata?: Record<string, unknown> | null
}

export const updateBrandStep = createStep(
  "update-brand",
  async (input: UpdateBrandStepInput, { container }) => {
    const brandModuleService: BrandModuleService =
      container.resolve(BRAND_MODULE)

    const { id, ...data } = input
    const fields = Object.keys(data)

    // Only the fields being changed are kept, so compensation restores exactly those.
    const previous = await brandModuleService.retrieveBrand(id, {
      select: ["id", ...fields],
    })

    try {
      const brand = await brandModuleService.updateBrands(input)

      return new StepResponse(brand, previous)
    } catch (error) {
      // A concurrent request may have taken the name or handle after
      // validateBrandUniqueStep ran; the unique index rejects this update.
      const conflict = await findBrandConflict(brandModuleService, {
        name: data.name,
        handle: data.handle,
        exclude_id: id,
      })

      throw conflict ? brandConflictError(conflict) : error
    }
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }

    const brandModuleService: BrandModuleService =
      container.resolve(BRAND_MODULE)

    await brandModuleService.updateBrands(previous)
  }
)
