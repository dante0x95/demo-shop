import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import SeoModule from "../modules/seo"

// Read-only: `product_seo_override.product_id` holds the product id, so there
// is no link table to keep in sync and the unique index allows one row per
// product. Lets Query read `product.product_seo_override` (null when the
// admin never edited the product's SEO).
export default defineLink(
  {
    linkable: ProductModule.linkable.product,
    field: "id",
  },
  {
    ...SeoModule.linkable.productSeoOverride.id,
    primaryKey: "product_id",
  },
  {
    readOnly: true,
  }
)
