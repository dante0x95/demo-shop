import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { PRODUCT_OWNER_TYPE } from "./set-product-metafields"
import { deleteMetafieldValuesStep } from "./steps/delete-metafield-values"

export type DeleteProductMetafieldWorkflowInput = {
  product_id: string
  key: string
}

// Removes one of a product's values, with or without a definition.
export const deleteProductMetafieldWorkflow = createWorkflow(
  "delete-product-metafield",
  function (input: DeleteProductMetafieldWorkflowInput) {
    // Unknown or deleted product -> 404.
    useQueryGraphStep({
      entity: "product",
      fields: ["id"],
      filters: { id: input.product_id },
      options: { throwIfKeyNotFound: true },
    })

    deleteMetafieldValuesStep(
      transform({ input }, ({ input }) => ({
        owner_type: PRODUCT_OWNER_TYPE,
        owner_id: input.product_id,
        key: input.key,
        require_existing: true,
      }))
    )

    return new WorkflowResponse(input)
  }
)
