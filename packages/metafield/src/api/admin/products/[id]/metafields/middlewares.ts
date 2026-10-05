import {
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { AdminSetProductMetafields } from "./validators"

export const adminProductMetafieldRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/products/:id/metafields",
    middlewares: [validateAndTransformBody(AdminSetProductMetafields)],
  },
]
