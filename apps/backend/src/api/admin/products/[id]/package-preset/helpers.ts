import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { resolvePackagePreset } from "../../../../../modules/package-preset/utils/resolve-package-preset"
import { defaultAdminPackagePresetFields } from "../../../package-presets/query-config"

type AdminPackagePreset = Record<string, unknown>

export type AdminProductPackagePreset = {
  product_id: string
  // The preset picked for the product; null = none picked.
  package_preset: AdminPackagePreset | null
  // The preset the product ships in when shipped alone: its own, else the
  // store's default, else null (the shop has no default preset).
  resolved: AdminPackagePreset | null
}

export const retrieveAdminProductPackagePreset = async (
  scope: MedusaContainer,
  productId: string
): Promise<AdminProductPackagePreset> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: [
      "id",
      ...defaultAdminPackagePresetFields.map(
        (field) => `package_preset.${field}`
      ),
    ],
    filters: { id: productId },
  })

  if (!product) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${productId} was not found`
    )
  }

  const productPreset =
    (product.package_preset as AdminPackagePreset | null | undefined) ?? null

  let defaultPreset: AdminPackagePreset | null = null

  if (!productPreset) {
    const {
      data: [storeDefault],
    } = await query.graph({
      entity: "package_preset",
      fields: defaultAdminPackagePresetFields,
      filters: { is_default: true },
    })

    defaultPreset = storeDefault ?? null
  }

  return {
    product_id: product.id,
    package_preset: productPreset,
    resolved: resolvePackagePreset(productPreset, defaultPreset),
  }
}
