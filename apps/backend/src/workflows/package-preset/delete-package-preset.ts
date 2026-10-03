import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { deletePackagePresetStep } from "./steps/delete-package-preset"

export type DeletePackagePresetWorkflowInput = {
  id: string
}

// Deleting the default leaves the shop without one until another preset is
// created as default.
export const deletePackagePresetWorkflow = createWorkflow(
  "delete-package-preset",
  function (input: DeletePackagePresetWorkflowInput) {
    // Unknown or already deleted id -> 404.
    useQueryGraphStep({
      entity: "package_preset",
      fields: ["id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    })

    deletePackagePresetStep(input.id)

    return new WorkflowResponse(input.id)
  }
)
