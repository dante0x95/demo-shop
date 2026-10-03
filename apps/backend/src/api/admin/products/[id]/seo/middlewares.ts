import {
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { AdminUpdateProductSeo } from "./validators"

export const adminProductSeoRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/products/:id/seo",
    middlewares: [validateAndTransformBody(AdminUpdateProductSeo)],
  },
]
