import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import {
  upsertProductSeoStep,
  UpsertProductSeoStepInput,
} from "./steps/upsert-product-seo"

export type UpdateProductSeoWorkflowInput = UpsertProductSeoStepInput

// Sets a product's SEO title and meta description. An empty or
// whitespace-only value clears the field, which falls back to the product's
// own title / description again.
export const updateProductSeoWorkflow = createWorkflow(
  "update-product-seo",
  function (input: UpdateProductSeoWorkflowInput) {
    // Unknown or deleted product -> 404 before anything is stored.
    useQueryGraphStep({
      entity: "product",
      fields: ["id"],
      filters: { id: input.product_id },
      options: { throwIfKeyNotFound: true },
    })

    const productSeo = upsertProductSeoStep(input)

    return new WorkflowResponse(productSeo)
  }
)
