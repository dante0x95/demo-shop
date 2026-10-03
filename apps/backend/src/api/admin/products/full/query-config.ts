import { defaultAdminProductFields } from "@medusajs/medusa/api/admin/products/query-config"

// Core `GET /admin/products/:id` fields, plus what this route creates outside
// the product module: stock per location and the brand.
export const defaultAdminProductFullFields = [
  ...defaultAdminProductFields,
  "variants.inventory_items.inventory_item_id",
  "variants.inventory_items.inventory.location_levels.location_id",
  "variants.inventory_items.inventory.location_levels.stocked_quantity",
  "brand.id",
  "brand.name",
  "brand.handle",
]

export const retrieveProductFullTransformQueryConfig = {
  defaults: defaultAdminProductFullFields,
  isList: false,
}
