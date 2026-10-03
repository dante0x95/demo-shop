import { MiddlewareRoute } from "@medusajs/framework/http"
import { withProductSeo } from "./helpers"

// Every store route that returns products exposes their resolved SEO values,
// so storefronts get one product shape.
export const storeProductSeoMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/brands/:id/products",
    middlewares: [withProductSeo()],
  },
  {
    method: ["GET"],
    matcher: "/store/products",
    middlewares: [withProductSeo()],
  },
  {
    method: ["GET"],
    matcher: "/store/products/:id",
    middlewares: [withProductSeo()],
  },
]
