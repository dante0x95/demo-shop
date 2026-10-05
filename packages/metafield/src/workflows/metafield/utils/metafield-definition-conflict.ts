import { MedusaError } from "@medusajs/framework/utils"
import MetafieldModuleService from "../../../modules/metafield/service"

export type MetafieldDefinitionConflictInput = {
  owner_type: string
  key: string
}

// Whether a non-deleted definition already uses this key for the owner type.
export const hasMetafieldDefinitionConflict = async (
  metafieldModuleService: MetafieldModuleService,
  { owner_type, key }: MetafieldDefinitionConflictInput
): Promise<boolean> => {
  const existing = await metafieldModuleService.listMetafieldDefinitions(
    { owner_type, key },
    { select: ["id"], take: 1 }
  )

  return existing.length > 0
}

export const metafieldDefinitionConflictError = ({
  owner_type,
  key,
}: MetafieldDefinitionConflictInput) =>
  new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `A metafield definition with key ${key} already exists for owner type ${owner_type}`
  )
