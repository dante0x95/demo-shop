import { DeleteEntityInput } from "@medusajs/framework/modules-sdk"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  removeRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { PACKAGE_PRESET_MODULE } from "../../modules/package-preset"
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

    // Products that used this preset are unlinked (never deleted), so the
    // store's default preset applies to them again.
    removeRemoteLinkStep(
      transform({ input }, ({ input }): DeleteEntityInput => ({
        [PACKAGE_PRESET_MODULE]: { package_preset_id: input.id },
      }))
    )

    return new WorkflowResponse(input.id)
  }
)
