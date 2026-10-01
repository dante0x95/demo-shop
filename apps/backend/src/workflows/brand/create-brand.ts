import { toHandle } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createBrandStep, CreateBrandStepInput } from "./steps/create-brand"
import { validateBrandUniqueStep } from "./steps/validate-brand-unique"

export type CreateBrandWorkflowInput = Omit<CreateBrandStepInput, "handle"> & {
  handle?: string
}

export const createBrandWorkflow = createWorkflow(
  "create-brand",
  function (input: CreateBrandWorkflowInput) {
    const handleSource = transform(
      { input },
      ({ input }) => input.handle ?? input.name
    )

    const brandData = transform({ input, handleSource }, ({ input, handleSource }) => ({
      ...input,
      name: input.name.trim(),
      handle: toHandle(handleSource),
    }))

    validateBrandUniqueStep({
      name: brandData.name,
      handle: brandData.handle,
      handle_source: handleSource,
    })

    const brand = createBrandStep(brandData)

    return new WorkflowResponse(brand)
  }
)
