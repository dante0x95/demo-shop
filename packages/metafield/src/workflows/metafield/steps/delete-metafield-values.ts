import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../../modules/metafield"
import MetafieldModuleService from "../../../modules/metafield/service"

export type DeleteMetafieldValuesStepInput = {
  owner_type: string
  key: string
  // Only this owner's value; every owner's when left out.
  owner_id?: string
  // Fail with 404 when there is nothing to delete.
  require_existing?: boolean
}

// Soft-deletes the values of a key, so a failed workflow can restore them.
export const deleteMetafieldValuesStep = createStep(
  "delete-metafield-values",
  async (input: DeleteMetafieldValuesStepInput, { container }) => {
    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    const values = await metafieldModuleService.listMetafieldValues(
      {
        owner_type: input.owner_type,
        key: input.key,
        ...(input.owner_id ? { owner_id: input.owner_id } : {}),
      },
      { select: ["id"] }
    )

    if (!values.length && input.require_existing) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        input.owner_id
          ? `Metafield ${input.key} has no value for ${input.owner_type} ${input.owner_id}`
          : `Metafield ${input.key} has no values for owner type ${input.owner_type}`
      )
    }

    const ids = values.map((value) => value.id)

    if (ids.length) {
      await metafieldModuleService.softDeleteMetafieldValues(ids)
    }

    return new StepResponse(ids, ids)
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }

    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    await metafieldModuleService.restoreMetafieldValues(ids)
  }
)
