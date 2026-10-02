import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { deleteMetafieldDefinitionStep } from "./steps/delete-metafield-definition"

export type DeleteMetafieldDefinitionWorkflowInput = {
  id: string
}

export const deleteMetafieldDefinitionWorkflow = createWorkflow(
  "delete-metafield-definition",
  function (input: DeleteMetafieldDefinitionWorkflowInput) {
    // Unknown or already deleted id -> 404.
    useQueryGraphStep({
      entity: "metafield_definition",
      fields: ["id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    })

    deleteMetafieldDefinitionStep(input.id)

    return new WorkflowResponse(input.id)
  }
)
