import {
  createWorkflow,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { setDefaultPackagePresetStep } from "./steps/set-default-package-preset"
import { unsetDefaultPackagePresetStep } from "./steps/unset-default-package-preset"

export type SetDefaultPackagePresetWorkflowInput = {
  id: string
}

// The preset replaces the current default: there is only ever one default.
// Marking the current default again changes nothing.
export const setDefaultPackagePresetWorkflow = createWorkflow(
  "set-default-package-preset",
  function (input: SetDefaultPackagePresetWorkflowInput) {
    // Unknown or deleted id -> 404.
    const { data: presets } = useQueryGraphStep({
      entity: "package_preset",
      fields: ["id", "is_default"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    })

    when({ presets }, ({ presets }) => !presets[0]?.is_default).then(() => {
      unsetDefaultPackagePresetStep()
      setDefaultPackagePresetStep(input.id)
    })

    return new WorkflowResponse(input.id)
  }
)
