export const defaultAdminMediaAssetFields = [
  "id",
  "url",
  "file_id",
  "filename",
  "mime_type",
  "size",
  "alt",
  "metadata",
  "created_at",
  "updated_at",
]

export const retrieveMediaAssetTransformQueryConfig = {
  defaults: defaultAdminMediaAssetFields,
  isList: false,
}
