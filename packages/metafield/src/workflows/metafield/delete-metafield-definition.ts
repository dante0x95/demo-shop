import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { deleteMetafieldDefinitionStep } from "./steps/delete-metafield-definition"
import { deleteMetafieldValuesStep } from "./steps/delete-metafield-values"
import { metafieldLockInput } from "./utils/lock"

export type DeleteMetafieldDefinitionWorkflowInput = {
  id: string
  // By default the values stay ("unstructured") and a new definition with
  // the same owner type and key reconnects them.
  delete_values?: boolean
}

export const deleteMetafieldDefinitionWorkflow = createWorkflow(
  "delete-metafield-definition",
  function (input: DeleteMetafieldDefinitionWorkflowInput) {
    // Unknown or already deleted id -> 404.
    const { data: definitions } = useQueryGraphStep({
      entity: "metafield_definition",
      fields: ["id", "owner_type", "key"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    })

    const valuesSelector = transform(
      { definitions },
      ({ definitions: [definition] }) => ({
        owner_type: definition.owner_type as string,
        key: definition.key as string,
      })
    )

    // An edit checked against this definition can't land after it is gone.
    const lock = transform({ definitions }, ({ definitions: [definition] }, context) =>
      metafieldLockInput(
        definition.owner_type,
        [definition.key],
        context.context.transactionId!
      )
    )

    acquireLockStep(lock)

    deleteMetafieldDefinitionStep(input.id)

    when({ input }, ({ input }) => input.delete_values === true).then(() => {
      deleteMetafieldValuesStep(valuesSelector)
    })

    releaseLockStep(lock)

    return new WorkflowResponse(input.id)
  }
)
