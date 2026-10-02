import { toHandle } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { updateBrandStep, UpdateBrandStepInput } from "./steps/update-brand"
import { validateBrandUniqueStep } from "./steps/validate-brand-unique"

export type UpdateBrandWorkflowInput = UpdateBrandStepInput

export const updateBrandWorkflow = createWorkflow(
  "update-brand",
  function (input: UpdateBrandWorkflowInput) {
    // Unknown id -> 404 before any validation runs.
    useQueryGraphStep({
      entity: "brand",
      fields: ["id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    })

    // The handle only changes when one is sent; renaming keeps the existing handle.
    const brandData = transform({ input }, ({ input }) => ({
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.handle !== undefined ? { handle: toHandle(input.handle) } : {}),
    }))

    validateBrandUniqueStep(
      transform({ input, brandData }, ({ input, brandData }) => ({
        name: brandData.name,
        handle: brandData.handle,
        handle_source: input.handle,
        exclude_id: input.id,
      }))
    )

    const brand = updateBrandStep(brandData)

    return new WorkflowResponse(brand)
  }
)
