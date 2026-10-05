import {
  applyDefaultFilters,
  clearFiltersByKey,
  maybeApplyLinkFilter,
  MiddlewareRoute,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { ProductStatus } from "@medusajs/framework/utils"
import {
  filterByValidSalesChannels,
  normalizeDataForContext,
  setPricingContext,
  setTaxContext,
} from "@medusajs/medusa/api/utils/middlewares/index"
import {
  listStoreBrandProductsTransformQueryConfig,
  listStoreBrandsTransformQueryConfig,
} from "./query-config"
import {
  StoreGetBrandProductsParams,
  StoreGetBrandsParams,
} from "./validators"

export const storeBrandRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/brands",
    middlewares: [
      validateAndTransformQuery(
        StoreGetBrandsParams,
        listStoreBrandsTransformQueryConfig
      ),
    ],
  },
  // Mirrors core `GET /store/products`: the key's sales channels narrow
  // `filterableFields.id`, only published products are listed, and the
  // pricing and tax contexts are built from `region_id` / `country_code`.
  {
    method: ["GET"],
    matcher: "/store/brands/:id/products",
    middlewares: [
      validateAndTransformQuery(
        StoreGetBrandProductsParams,
        listStoreBrandProductsTransformQueryConfig
      ),
      filterByValidSalesChannels(),
      maybeApplyLinkFilter({
        entryPoint: "product_sales_channel",
        resourceId: "product_id",
        filterableField: "sales_channel_id",
      }),
      applyDefaultFilters({ status: ProductStatus.PUBLISHED }),
      normalizeDataForContext(),
      setPricingContext(),
      setTaxContext(),
      clearFiltersByKey(["region_id", "country_code", "province", "cart_id"]),
    ],
  },
]
