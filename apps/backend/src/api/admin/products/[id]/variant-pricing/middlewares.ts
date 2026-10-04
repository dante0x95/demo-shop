import {
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { AdminUpdateVariantPricing } from "./validators"

export const adminVariantPricingRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/products/:id/variant-pricing",
    middlewares: [validateAndTransformBody(AdminUpdateVariantPricing)],
  },
]
