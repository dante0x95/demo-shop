import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { retrieveProductFullTransformQueryConfig } from "./query-config"
import {
  AdminCreateProductFull,
  AdminGetProductFullParams,
} from "./validators"

export const adminProductFullRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/products/full",
    middlewares: [
      validateAndTransformBody(AdminCreateProductFull),
      validateAndTransformQuery(
        AdminGetProductFullParams,
        retrieveProductFullTransformQueryConfig
      ),
    ],
  },
]
