import { model } from "@medusajs/framework/utils"

// The SEO values an admin set for a product, overriding the fallbacks. A row
// only exists once the admin edits them, and a null value means "not set":
// responses then fall back to the product's own title / description (see
// utils/product-seo.ts).
const ProductSeoOverride = model
  .define("product_seo_override", {
    id: model.id({ prefix: "pseo" }).primaryKey(),
    product_id: model.text(),
    title: model.text().nullable(),
    description: model.text().nullable(),
  })
  .indexes([
    {
      // One row per product, also under concurrent first edits.
      on: ["product_id"],
      unique: true,
    },
  ])

export default ProductSeoOverride
