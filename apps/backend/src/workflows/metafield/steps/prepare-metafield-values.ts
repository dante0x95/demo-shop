import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../../modules/metafield"
import MetafieldModuleService from "../../../modules/metafield/service"
import { prepareMetafieldValues } from "../../../modules/metafield/utils/values"

export type PrepareMetafieldValuesStepInput = {
  owner_type: string
  owner_id: string
  metafields: { key: string; value: unknown }[]
}

// Read-only, so nothing needs compensating: checks each value against its
// definition (or, without one, against the stored value's type) and returns
// what will be stored.
export const prepareMetafieldValuesStep = createStep(
  "prepare-metafield-values",
  async (input: PrepareMetafieldValuesStepInput, { container }) => {
    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    const keys = input.metafields.map((metafield) => metafield.key)

    const [definitions, existing] = await Promise.all([
      metafieldModuleService.listMetafieldDefinitions(
        { owner_type: input.owner_type, key: keys },
        { select: ["key", "type", "options"] }
      ),
      metafieldModuleService.listMetafieldValues(
        { owner_type: input.owner_type, owner_id: input.owner_id, key: keys },
        { select: ["key", "type"] }
      ),
    ])

    return new StepResponse(
      prepareMetafieldValues(
        input.owner_type,
        input.metafields,
        definitions,
        existing
      )
    )
  }
)
