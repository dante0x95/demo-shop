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
  AdminResendDriverInvite,
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
  {
    method: ["POST"],
    matcher: "/admin/drivers/:id/resend-invite",
    middlewares: [
      validateAndTransformBody(AdminResendDriverInvite),
      validateAndTransformQuery(
        AdminGetDriverParams,
        retrieveAdminDriverTransformQueryConfig
      ),
    ],
  },
]
