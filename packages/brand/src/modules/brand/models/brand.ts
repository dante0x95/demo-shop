import { model } from "@medusajs/framework/utils"

const Brand = model.define("brand", {
  id: model.id({ prefix: "brand" }).primaryKey(),
  name: model.text(),
  handle: model.text().unique(),
  description: model.text().nullable(),
  logo_url: model.text().nullable(),
  banner_url: model.text().nullable(),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default Brand
