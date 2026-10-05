import {
  createWorkflow,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createPackagePresetStep,
  CreatePackagePresetStepInput,
} from "./steps/create-package-preset"
import { unsetDefaultPackagePresetStep } from "./steps/unset-default-package-preset"

export type CreatePackagePresetWorkflowInput = CreatePackagePresetStepInput

// A new default replaces the current one: there is only ever one default.
export const createPackagePresetWorkflow = createWorkflow(
  "create-package-preset",
  function (input: CreatePackagePresetWorkflowInput) {
    when({ input }, ({ input }) => input.is_default === true).then(() => {
      unsetDefaultPackagePresetStep()
    })

    const packagePreset = createPackagePresetStep(input)

    return new WorkflowResponse(packagePreset)
  }
)
