import { MedusaError } from "@medusajs/framework/utils"
import MetafieldModuleService from "../../../modules/metafield/service"

// Owner types come from the `owner_types` module option.
export const assertOwnerTypeAllowed = async (
  metafieldModuleService: MetafieldModuleService,
  ownerType: string
) => {
  const { owner_types } = await metafieldModuleService.getOptions()

  if (!owner_types.includes(ownerType)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Owner type ${ownerType} is not allowed. Allowed owner types: ${owner_types.join(", ")}`
    )
  }
}
