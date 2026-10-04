import { MedusaError } from "@medusajs/framework/utils"
import { createStep } from "@medusajs/framework/workflows-sdk"
import { findVariantsNotInProduct } from "../../../modules/variant-pricing/utils/variant-pricing"

export type ValidateProductVariantsStepInput = {
  product: { id: string; variants?: ({ id: string } | null)[] | null }
  variant_ids: string[]
}

// Every variant edited must belong to the product in the URL; otherwise 404,
// before anything is stored. Reads only, so there is nothing to compensate.
export const validateProductVariantsStep = createStep(
  "validate-product-variants",
  async ({ product, variant_ids }: ValidateProductVariantsStepInput) => {
    const productVariantIds = (product.variants ?? [])
      .filter((variant): variant is { id: string } => !!variant)
      .map((variant) => variant.id)

    const unknown = findVariantsNotInProduct(productVariantIds, variant_ids)

    if (unknown.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Variants ${unknown.join(", ")} were not found in product ${product.id}`
      )
    }
  }
)
