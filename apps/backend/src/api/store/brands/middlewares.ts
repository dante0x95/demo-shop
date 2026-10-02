import {
  MiddlewareRoute,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { listStoreBrandsTransformQueryConfig } from "./query-config"
import { StoreGetBrandsParams } from "./validators"

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
]
