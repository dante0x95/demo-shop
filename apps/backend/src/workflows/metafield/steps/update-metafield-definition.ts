import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../../modules/metafield"
import MetafieldModuleService from "../../../modules/metafield/service"

// Only the storefront access flag can change (decided): key, type and
// options stay as created.
export type UpdateMetafieldDefinitionStepInput = {
  id: string
  storefront_access: boolean
}

export const updateMetafieldDefinitionStep = createStep(
  "update-metafield-definition",
  async (input: UpdateMetafieldDefinitionStepInput, { container }) => {
    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    const previous = await metafieldModuleService.retrieveMetafieldDefinition(
      input.id,
      { select: ["id", "storefront_access"] }
    )

    const metafieldDefinition =
      await metafieldModuleService.updateMetafieldDefinitions(input)

    return new StepResponse(metafieldDefinition, {
      id: previous.id,
      storefront_access: previous.storefront_access,
    })
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }

    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    await metafieldModuleService.updateMetafieldDefinitions(previous)
  }
)
