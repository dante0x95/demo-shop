export const defaultDriverFields = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "vehicle_type",
  "license_plate",
  "is_active",
  "metadata",
  "created_at",
  "updated_at",
]

export const retrieveDriverTransformQueryConfig = {
  defaults: defaultDriverFields,
  isList: false,
}
