import { model } from "@medusajs/framework/utils"
import { METAFIELD_TYPES } from "./metafield-definition"

// A value belongs to owner type + owner id + key, not to a definition
// (Shopify parity): deleting a definition can keep its values, and a new
// definition with the same owner type and key picks them up again. The value
// keeps its own type so it can still be checked without a definition.
const MetafieldValue = model
  .define("metafield_value", {
    id: model.id({ prefix: "mfval" }).primaryKey(),
    owner_type: model.text(),
    owner_id: model.text(),
    key: model.text(),
    type: model.enum([...METAFIELD_TYPES]),
    // Serialized as text whatever the type; see utils/values.ts.
    value: model.text(),
  })
  .indexes([
    {
      // One value per key and owner, also under concurrent first edits.
      on: ["owner_type", "owner_id", "key"],
      unique: true,
    },
    {
      // Every value of a key: definition checks, unstructured keys.
      on: ["owner_type", "key"],
    },
  ])

export default MetafieldValue
