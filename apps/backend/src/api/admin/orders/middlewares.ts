import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { retrieveOrderDriverTransformQueryConfig } from "./query-config"
import { AdminAssignDriver, AdminGetOrderDriverParams } from "./validators"

export const adminOrderRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/assign-driver",
    middlewares: [
      validateAndTransformBody(AdminAssignDriver),
      validateAndTransformQuery(
        AdminGetOrderDriverParams,
        retrieveOrderDriverTransformQueryConfig
      ),
    ],
  },
]
