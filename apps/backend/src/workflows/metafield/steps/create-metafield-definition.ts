import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../../modules/metafield"
import { MetafieldType } from "../../../modules/metafield/models/metafield-definition"
import MetafieldModuleService from "../../../modules/metafield/service"
import {
  hasMetafieldDefinitionConflict,
  metafieldDefinitionConflictError,
} from "../utils/metafield-definition-conflict"

export type CreateMetafieldDefinitionStepInput = {
  key: string
  label: string
  type: MetafieldType
  options?: string[] | null
  owner_type: string
}

export const createMetafieldDefinitionStep = createStep(
  "create-metafield-definition",
  async (input: CreateMetafieldDefinitionStepInput, { container }) => {
    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    try {
      const metafieldDefinition =
        await metafieldModuleService.createMetafieldDefinitions({
          ...input,
          // A jsonb column holding a string array; the DML types json as a record.
          options: (input.options ?? null) as Record<string, unknown> | null,
        })

      return new StepResponse(metafieldDefinition, metafieldDefinition.id)
    } catch (error) {
      // A concurrent request may have taken the key after
      // validateMetafieldDefinitionStep ran; the unique index rejects this insert.
      const conflict = await hasMetafieldDefinitionConflict(
        metafieldModuleService,
        input
      )

      throw conflict ? metafieldDefinitionConflictError(input) : error
    }
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    await metafieldModuleService.deleteMetafieldDefinitions(id)
  }
)
