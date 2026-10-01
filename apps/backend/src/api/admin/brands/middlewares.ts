import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  listBrandsTransformQueryConfig,
  retrieveBrandTransformQueryConfig,
} from "./query-config"
import {
  AdminCreateBrand,
  AdminGetBrandParams,
  AdminGetBrandsParams,
} from "./validators"

export const adminBrandRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/brands",
    middlewares: [
      validateAndTransformQuery(
        AdminGetBrandsParams,
        listBrandsTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/brands",
    middlewares: [
      validateAndTransformBody(AdminCreateBrand),
      validateAndTransformQuery(
        AdminGetBrandParams,
        retrieveBrandTransformQueryConfig
      ),
    ],
  },
]
