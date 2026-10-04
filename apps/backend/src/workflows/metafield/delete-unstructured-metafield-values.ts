import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { deleteMetafieldValuesStep } from "./steps/delete-metafield-values"
import {
  validateUnstructuredMetafieldKeyStep,
  ValidateUnstructuredMetafieldKeyStepInput,
} from "./steps/validate-unstructured-metafield-key"
import { metafieldLockInput } from "./utils/lock"

export type DeleteUnstructuredMetafieldValuesWorkflowInput =
  ValidateUnstructuredMetafieldKeyStepInput

// Deletes every value of a key that has no definition, for every owner.
export const deleteUnstructuredMetafieldValuesWorkflow = createWorkflow(
  "delete-unstructured-metafield-values",
  function (input: DeleteUnstructuredMetafieldValuesWorkflowInput) {
    // A definition created meanwhile would otherwise lose the values it
    // just reconnected.
    const lock = transform({ input }, ({ input }, context) =>
      metafieldLockInput(input.owner_type, [input.key], context.context.transactionId!)
    )

    acquireLockStep(lock)

    validateUnstructuredMetafieldKeyStep(input)

    const deletedIds = deleteMetafieldValuesStep(
      transform({ input }, ({ input }) => ({
        owner_type: input.owner_type,
        key: input.key,
        require_existing: true,
      }))
    )

    releaseLockStep(lock)

    return new WorkflowResponse(deletedIds)
  }
)
