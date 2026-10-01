import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BRAND_MODULE } from "../../../modules/brand"
import BrandModuleService from "../../../modules/brand/service"

export type CreateBrandStepInput = {
  name: string
  handle: string
  description?: string | null
  logo_url?: string | null
  banner_url?: string | null
  is_active?: boolean
  metadata?: Record<string, unknown> | null
}

export const createBrandStep = createStep(
  "create-brand",
  async (input: CreateBrandStepInput, { container }) => {
    const brandModuleService: BrandModuleService =
      container.resolve(BRAND_MODULE)

    const brand = await brandModuleService.createBrands(input)

    return new StepResponse(brand, brand.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const brandModuleService: BrandModuleService =
      container.resolve(BRAND_MODULE)

    await brandModuleService.deleteBrands(id)
  }
)
