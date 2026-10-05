import {
  MiddlewareRoute,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { AdminGetUnstructuredMetafieldsParams } from "./validators"

export const adminMetafieldRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/metafields/unstructured/:owner_type",
    middlewares: [
      validateAndTransformQuery(AdminGetUnstructuredMetafieldsParams, {
        defaults: ["key", "type", "values_count"],
        defaultLimit: 20,
        isList: true,
      }),
    ],
  },
]
