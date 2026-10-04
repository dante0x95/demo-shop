import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  listUnstructuredMetafieldKeysStep,
  ListUnstructuredMetafieldKeysStepInput,
} from "./steps/list-unstructured-metafield-keys"

export type ListUnstructuredMetafieldKeysWorkflowInput =
  ListUnstructuredMetafieldKeysStepInput

// Keys of an owner type with values but no definition, for the admin to
// reconnect (create a definition) or delete.
export const listUnstructuredMetafieldKeysWorkflow = createWorkflow(
  "list-unstructured-metafield-keys",
  function (input: ListUnstructuredMetafieldKeysWorkflowInput) {
    const result = listUnstructuredMetafieldKeysStep(input)

    return new WorkflowResponse(result)
  }
)
