import { MedusaError } from "@medusajs/framework/utils"

export type MetafieldModuleOptions = {
  // Entities a definition can target, e.g. "product".
  owner_types?: string[]
}

export type ResolvedMetafieldModuleOptions = Required<MetafieldModuleOptions>

export const DEFAULT_OWNER_TYPES = ["product"]

// Applies defaults and fails at startup on a bad configuration, so a typo
// never leaves the module without a usable owner type.
export const resolveMetafieldModuleOptions = (
  options: MetafieldModuleOptions = {}
): ResolvedMetafieldModuleOptions => {
  const ownerTypes = options.owner_types ?? DEFAULT_OWNER_TYPES

  if (
    !Array.isArray(ownerTypes) ||
    !ownerTypes.length ||
    ownerTypes.some(
      (ownerType) => typeof ownerType !== "string" || !ownerType.trim()
    )
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_ARGUMENT,
      `Metafield module option owner_types must be a non-empty list of non-empty strings, received ${JSON.stringify(ownerTypes)}`
    )
  }

  return {
    owner_types: [...new Set(ownerTypes.map((ownerType) => ownerType.trim()))],
  }
}
