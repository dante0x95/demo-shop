import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  listAdminDriversTransformQueryConfig,
  retrieveAdminDriverTransformQueryConfig,
} from "./query-config"
import {
  AdminCreateDriver,
  AdminGetDriverParams,
  AdminGetDriversParams,
} from "./validators"

export const adminDriverRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/drivers",
    middlewares: [
      validateAndTransformQuery(
        AdminGetDriversParams,
        listAdminDriversTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/drivers",
    middlewares: [
      validateAndTransformBody(AdminCreateDriver),
      validateAndTransformQuery(
        AdminGetDriverParams,
        retrieveAdminDriverTransformQueryConfig
      ),
    ],
  },
]
