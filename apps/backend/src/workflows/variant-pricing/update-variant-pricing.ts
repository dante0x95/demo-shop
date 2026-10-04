import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import {
  upsertVariantPriceDetailsStep,
  VariantPriceDetailInput,
} from "./steps/upsert-variant-price-details"
import { validateProductVariantsStep } from "./steps/validate-product-variants"

export type UpdateVariantPricingWorkflowInput = {
  product_id: string
  variants: VariantPriceDetailInput[]
}

// Sets the compare-at price and cost per item of some of a product's
// variants. null clears a value; a value left out keeps what is stored.
export const updateVariantPricingWorkflow = createWorkflow(
  "update-variant-pricing",
  function (input: UpdateVariantPricingWorkflowInput) {
    // Unknown or deleted product -> 404 before anything is stored.
    const { data: product } = useQueryGraphStep({
      entity: "product",
      fields: ["id", "variants.id"],
      filters: { id: input.product_id },
      options: { isList: false, throwIfKeyNotFound: true },
    })

    const variantIds = transform({ input }, ({ input }) =>
      input.variants.map((variant) => variant.variant_id)
    )

    validateProductVariantsStep({ product, variant_ids: variantIds })

    const result = upsertVariantPriceDetailsStep(input.variants)

    return new WorkflowResponse(result)
  }
)
