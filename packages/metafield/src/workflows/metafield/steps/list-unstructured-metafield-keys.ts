import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../../modules/metafield"
import MetafieldModuleService from "../../../modules/metafield/service"
import { assertOwnerTypeAllowed } from "../utils/owner-type"

export type ListUnstructuredMetafieldKeysStepInput = {
  owner_type: string
  skip: number
  take: number
}

// Read-only, so nothing needs compensating. Query can't group values by key,
// so the module service runs the aggregate.
export const listUnstructuredMetafieldKeysStep = createStep(
  "list-unstructured-metafield-keys",
  async (input: ListUnstructuredMetafieldKeysStepInput, { container }) => {
    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    await assertOwnerTypeAllowed(metafieldModuleService, input.owner_type)

    const [keys, count] =
      await metafieldModuleService.listAndCountUnstructuredMetafieldKeys(
        input.owner_type,
        { skip: input.skip, take: input.take }
      )

    return new StepResponse({ keys, count })
  }
)
