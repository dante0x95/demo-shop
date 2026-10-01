export const defaultAdminBrandFields = [
  "id",
  "name",
  "handle",
  "description",
  "logo_url",
  "banner_url",
  "is_active",
  "metadata",
  "created_at",
  "updated_at",
]

export const retrieveBrandTransformQueryConfig = {
  defaults: defaultAdminBrandFields,
  isList: false,
}

export const listBrandsTransformQueryConfig = {
  ...retrieveBrandTransformQueryConfig,
  defaultLimit: 20,
  isList: true,
}
