import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../../modules/metafield"
import { MetafieldType } from "../../../modules/metafield/models/metafield-definition"
import MetafieldModuleService from "../../../modules/metafield/service"
import { findMetafieldReconnectConflict } from "../../../modules/metafield/utils/values"
import {
  hasMetafieldDefinitionConflict,
  metafieldDefinitionConflictError,
} from "../utils/metafield-definition-conflict"
import { assertOwnerTypeAllowed } from "../utils/owner-type"

export type ValidateMetafieldDefinitionStepInput = {
  key: string
  type: MetafieldType
  options?: string[] | null
  owner_type: string
}

const invalid = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message)

// Early, friendly check. The unique index on (owner_type, key) is what
// actually enforces uniqueness when requests race; see
// createMetafieldDefinitionStep.
export const validateMetafieldDefinitionStep = createStep(
  "validate-metafield-definition",
  async (input: ValidateMetafieldDefinitionStepInput, { container }) => {
    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    await assertOwnerTypeAllowed(metafieldModuleService, input.owner_type)

    const options = input.options ?? null

    if (input.type === "select") {
      if (!options?.length) {
        throw invalid("A select metafield definition needs at least one option")
      }

      if (new Set(options).size !== options.length) {
        throw invalid("Metafield definition options must be unique")
      }
    } else if (options !== null) {
      throw invalid(
        `Options are only allowed for select metafield definitions, not ${input.type}`
      )
    }

    if (await hasMetafieldDefinitionConflict(metafieldModuleService, input)) {
      throw metafieldDefinitionConflictError(input)
    }

    // Values kept from a deleted definition with this owner type and key are
    // reconnected to the new one, so they must fit it.
    const existingValues = await metafieldModuleService.listMetafieldValues(
      { owner_type: input.owner_type, key: input.key },
      { select: ["type", "value"] }
    )

    const reconnectConflict = findMetafieldReconnectConflict(
      { key: input.key, type: input.type, options },
      existingValues
    )

    if (reconnectConflict) {
      throw new MedusaError(MedusaError.Types.CONFLICT, reconnectConflict)
    }

    return new StepResponse(undefined)
  }
)
