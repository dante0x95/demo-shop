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
import { BRAND_MODULE } from "../../modules/brand"
import { deleteBrandStep } from "./steps/delete-brand"

export type DeleteBrandWorkflowInput = {
  id: string
}

export const deleteBrandWorkflow = createWorkflow(
  "delete-brand",
  function (input: DeleteBrandWorkflowInput) {
    // Unknown or already deleted id -> 404.
    useQueryGraphStep({
      entity: "brand",
      fields: ["id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    })

    deleteBrandStep(input.id)

    // Removes the brand's product links; the products themselves are kept.
    removeRemoteLinkStep(
      transform({ input }, ({ input }): DeleteEntityInput => ({
        [BRAND_MODULE]: { brand_id: input.id },
      }))
    )

    return new WorkflowResponse(input.id)
  }
)
