import { retrieveProductQueryConfig } from "@medusajs/medusa/api/store/products/query-config"

export const defaultStoreBrandFields = [
  "id",
  "name",
  "handle",
  "description",
  "logo_url",
  "banner_url",
]

// `disallowed` is enforced regardless of feature flags, so a storefront can't
// pull internal fields or draft products through `?fields=`.
export const listStoreBrandsTransformQueryConfig = {
  defaults: defaultStoreBrandFields,
  allowed: defaultStoreBrandFields,
  disallowed: ["products", "metadata", "is_active"],
  defaultLimit: 20,
  isList: true,
}

// Same fields as core `GET /store/products`, so storefronts get one product shape.
export const listStoreBrandProductsTransformQueryConfig = {
  ...retrieveProductQueryConfig,
  defaultLimit: 20,
  isList: true,
}
