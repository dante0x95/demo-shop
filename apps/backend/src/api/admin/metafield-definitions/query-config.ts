export const defaultAdminMetafieldDefinitionFields = [
  "id",
  "key",
  "label",
  "type",
  "options",
  "owner_type",
  "storefront_access",
  "created_at",
  "updated_at",
]

export const retrieveMetafieldDefinitionTransformQueryConfig = {
  defaults: defaultAdminMetafieldDefinitionFields,
  isList: false,
}

// The DELETE route returns no entity; its query only carries delete_values.
export const deleteMetafieldDefinitionTransformQueryConfig = {
  defaults: ["id"],
  isList: false,
}

export const listMetafieldDefinitionsTransformQueryConfig = {
  ...retrieveMetafieldDefinitionTransformQueryConfig,
  defaultLimit: 20,
  isList: true,
}
