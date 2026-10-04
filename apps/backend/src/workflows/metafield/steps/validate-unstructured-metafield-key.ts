import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../../modules/metafield"
import MetafieldModuleService from "../../../modules/metafield/service"
import { hasMetafieldDefinitionConflict } from "../utils/metafield-definition-conflict"
import { assertOwnerTypeAllowed } from "../utils/owner-type"

export type ValidateUnstructuredMetafieldKeyStepInput = {
  owner_type: string
  key: string
}

// Read-only, so nothing needs compensating. A key with a definition isn't
// unstructured: its values go with the definition
// (DELETE /admin/metafield-definitions/:id?delete_values=true).
export const validateUnstructuredMetafieldKeyStep = createStep(
  "validate-unstructured-metafield-key",
  async (input: ValidateUnstructuredMetafieldKeyStepInput, { container }) => {
    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    await assertOwnerTypeAllowed(metafieldModuleService, input.owner_type)

    if (await hasMetafieldDefinitionConflict(metafieldModuleService, input)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Metafield ${input.key} has a definition for owner type ${input.owner_type}; delete the definition with delete_values=true to remove its values`
      )
    }

    return new StepResponse(undefined)
  }
)
