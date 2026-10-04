import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import PackagePresetModule from "../modules/package-preset"

// "Package when shipped alone": a preset packs many products; a product has at
// most one preset (none set = the store's default preset).
export default defineLink(
  {
    linkable: ProductModule.linkable.product,
    isList: true,
  },
  PackagePresetModule.linkable.packagePreset
)
