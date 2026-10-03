export const defaultAdminOrderDriverFields = [
  "id",
  "display_id",
  "status",
  "email",
  "driver.id",
  "driver.first_name",
  "driver.last_name",
  "driver.phone",
  "driver.vehicle_type",
]

export const retrieveOrderDriverTransformQueryConfig = {
  defaults: defaultAdminOrderDriverFields,
  isList: false,
}
