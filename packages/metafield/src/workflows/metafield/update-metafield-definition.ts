import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import {
  updateMetafieldDefinitionStep,
  UpdateMetafieldDefinitionStepInput,
} from "./steps/update-metafield-definition"

export type UpdateMetafieldDefinitionWorkflowInput =
  UpdateMetafieldDefinitionStepInput

export const updateMetafieldDefinitionWorkflow = createWorkflow(
  "update-metafield-definition",
  function (input: UpdateMetafieldDefinitionWorkflowInput) {
    // Unknown or deleted id -> 404.
    useQueryGraphStep({
      entity: "metafield_definition",
      fields: ["id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    })

    const metafieldDefinition = updateMetafieldDefinitionStep(input)

    return new WorkflowResponse(metafieldDefinition)
  }
)
