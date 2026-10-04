import { model } from "@medusajs/framework/utils"

export const METAFIELD_TYPES = ["text", "number", "boolean", "select"] as const

export type MetafieldType = (typeof METAFIELD_TYPES)[number]

const MetafieldDefinition = model
  .define("metafield_definition", {
    id: model.id({ prefix: "mfdef" }).primaryKey(),
    key: model.text(),
    label: model.text(),
    type: model.enum([...METAFIELD_TYPES]),
    // Allowed values for `select`; null for every other type.
    options: model.json().nullable(),
    owner_type: model.text(),
    // Whether `/store` may return this definition's values. Off by default.
    storefront_access: model.boolean().default(false),
  })
  .indexes([
    {
      // Scoped to non-deleted rows, so a deleted definition's key can be reused.
      on: ["owner_type", "key"],
      unique: true,
    },
  ])

export default MetafieldDefinition
