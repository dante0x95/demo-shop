import { model } from "@medusajs/framework/utils"

const MediaAsset = model.define("media_asset", {
  id: model.id({ prefix: "media" }).primaryKey(),
  url: model.text(),
  file_id: model.text(),
  filename: model.text(),
  mime_type: model.text(),
  size: model.number(),
  alt: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default MediaAsset
