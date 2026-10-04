import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { deleteMetafieldDefinitionStep } from "./steps/delete-metafield-definition"
import { deleteMetafieldValuesStep } from "./steps/delete-metafield-values"

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

    deleteMetafieldDefinitionStep(input.id)

    const valuesSelector = transform(
      { definitions },
      ({ definitions: [definition] }) => ({
        owner_type: definition.owner_type as string,
        key: definition.key as string,
      })
    )

    when({ input }, ({ input }) => input.delete_values === true).then(() => {
      deleteMetafieldValuesStep(valuesSelector)
    })

    return new WorkflowResponse(input.id)
  }
)
