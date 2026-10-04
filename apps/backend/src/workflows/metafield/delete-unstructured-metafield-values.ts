import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { deleteMetafieldValuesStep } from "./steps/delete-metafield-values"
import {
  validateUnstructuredMetafieldKeyStep,
  ValidateUnstructuredMetafieldKeyStepInput,
} from "./steps/validate-unstructured-metafield-key"

export type DeleteUnstructuredMetafieldValuesWorkflowInput =
  ValidateUnstructuredMetafieldKeyStepInput

// Deletes every value of a key that has no definition, for every owner.
export const deleteUnstructuredMetafieldValuesWorkflow = createWorkflow(
  "delete-unstructured-metafield-values",
  function (input: DeleteUnstructuredMetafieldValuesWorkflowInput) {
    validateUnstructuredMetafieldKeyStep(input)

    const deletedIds = deleteMetafieldValuesStep(
      transform({ input }, ({ input }) => ({
        owner_type: input.owner_type,
        key: input.key,
        require_existing: true,
      }))
    )

    return new WorkflowResponse(deletedIds)
  }
)
