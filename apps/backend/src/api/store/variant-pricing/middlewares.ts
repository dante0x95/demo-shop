import { MiddlewareRoute } from "@medusajs/framework/http"
import { withVariantCompareAt } from "./helpers"

// Every store route that returns variants exposes their compare-at price as
// `compare_at_amount`, so storefronts get one variant shape.
export const storeVariantCompareAtMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/brands/:id/products",
    middlewares: [withVariantCompareAt()],
  },
  {
    method: ["GET"],
    matcher: "/store/product-variants",
    middlewares: [withVariantCompareAt()],
  },
  {
    method: ["GET"],
    matcher: "/store/product-variants/:id",
    middlewares: [withVariantCompareAt()],
  },
  {
    method: ["GET"],
    matcher: "/store/products",
    middlewares: [withVariantCompareAt()],
  },
  {
    method: ["GET"],
    matcher: "/store/products/:id",
    middlewares: [withVariantCompareAt()],
  },
]
