import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BRAND_MODULE } from "../../../modules/brand"
import BrandModuleService from "../../../modules/brand/service"

export const deleteBrandStep = createStep(
  "delete-brand",
  async (id: string, { container }) => {
    const brandModuleService: BrandModuleService =
      container.resolve(BRAND_MODULE)

    await brandModuleService.softDeleteBrands(id)

    return new StepResponse(undefined, id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const brandModuleService: BrandModuleService =
      container.resolve(BRAND_MODULE)

    await brandModuleService.restoreBrands(id)
  }
)
