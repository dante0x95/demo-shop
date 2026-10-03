export const defaultAdminPackagePresetFields = [
  "id",
  "name",
  "length",
  "width",
  "height",
  "dimension_unit",
  "weight",
  "weight_unit",
  "is_default",
  "created_at",
  "updated_at",
]

export const retrievePackagePresetTransformQueryConfig = {
  defaults: defaultAdminPackagePresetFields,
  isList: false,
}

export const listPackagePresetsTransformQueryConfig = {
  ...retrievePackagePresetTransformQueryConfig,
  defaultLimit: 20,
  isList: true,
}
