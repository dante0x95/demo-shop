import { LinkDefinition } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { PACKAGE_PRESET_MODULE } from "../../../modules/package-preset"

export type ProductPackagePresetLinkChanges = {
  dismiss: LinkDefinition[]
  create: LinkDefinition[]
}

export const productPackagePresetLink = (
  productId: string,
  packagePresetId: string
): LinkDefinition => ({
  [Modules.PRODUCT]: { product_id: productId },
  [PACKAGE_PRESET_MODULE]: { package_preset_id: packagePresetId },
})

// The link changes that take a product from its current preset to the next
// one. null = no preset (the store's default applies). Setting the current
// preset again changes nothing; otherwise the current link goes first, since a
// product has at most one preset.
export const planProductPackagePresetLinks = ({
  productId,
  currentPackagePresetId,
  nextPackagePresetId,
}: {
  productId: string
  currentPackagePresetId: string | null
  nextPackagePresetId: string | null
}): ProductPackagePresetLinkChanges => {
  if (currentPackagePresetId === nextPackagePresetId) {
    return { dismiss: [], create: [] }
  }

  return {
    dismiss: currentPackagePresetId
      ? [productPackagePresetLink(productId, currentPackagePresetId)]
      : [],
    create: nextPackagePresetId
      ? [productPackagePresetLink(productId, nextPackagePresetId)]
      : [],
  }
}
