import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../../modules/metafield"
import MetafieldModuleService from "../../../modules/metafield/service"

export const deleteMetafieldDefinitionStep = createStep(
  "delete-metafield-definition",
  async (id: string, { container }) => {
    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    await metafieldModuleService.softDeleteMetafieldDefinitions(id)

    return new StepResponse(undefined, id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    await metafieldModuleService.restoreMetafieldDefinitions(id)
  }
)
