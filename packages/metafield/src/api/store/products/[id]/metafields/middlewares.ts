import {
  applyDefaultFilters,
  applyParamsAsFilters,
  clearFiltersByKey,
  maybeApplyLinkFilter,
  MiddlewareRoute,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { ProductStatus } from "@medusajs/framework/utils"
import { filterByValidSalesChannels } from "@medusajs/medusa/api/utils/middlewares/index"
import { StoreGetProductMetafieldsParams } from "./validators"

// Mirrors core `GET /store/products/:id`: the product must be published and
// in one of the publishable key's sales channels, or the route answers 404.
export const storeProductMetafieldRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/products/:id/metafields",
    middlewares: [
      validateAndTransformQuery(StoreGetProductMetafieldsParams, {
        defaults: ["id"],
        isList: false,
      }),
      clearFiltersByKey(["keys"]),
      applyParamsAsFilters({ id: "id" }),
      filterByValidSalesChannels(),
      maybeApplyLinkFilter({
        entryPoint: "product_sales_channel",
        resourceId: "product_id",
        filterableField: "sales_channel_id",
      }),
      applyDefaultFilters({ status: ProductStatus.PUBLISHED }),
    ],
  },
]
