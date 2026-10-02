export const defaultAdminMetafieldDefinitionFields = [
  "id",
  "key",
  "label",
  "type",
  "options",
  "owner_type",
  "created_at",
  "updated_at",
]

export const retrieveMetafieldDefinitionTransformQueryConfig = {
  defaults: defaultAdminMetafieldDefinitionFields,
  isList: false,
}

export const listMetafieldDefinitionsTransformQueryConfig = {
  ...retrieveMetafieldDefinitionTransformQueryConfig,
  defaultLimit: 20,
  isList: true,
}
