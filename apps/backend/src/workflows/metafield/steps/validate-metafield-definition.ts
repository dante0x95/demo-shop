import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../../modules/metafield"
import { MetafieldType } from "../../../modules/metafield/models/metafield-definition"
import MetafieldModuleService from "../../../modules/metafield/service"
import {
  hasMetafieldDefinitionConflict,
  metafieldDefinitionConflictError,
} from "../utils/metafield-definition-conflict"

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

    const { owner_types } = await metafieldModuleService.getOptions()

    if (!owner_types.includes(input.owner_type)) {
      throw invalid(
        `Owner type ${input.owner_type} is not allowed. Allowed owner types: ${owner_types.join(", ")}`
      )
    }

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

    return new StepResponse(undefined)
  }
)
