import { MiddlewareRoute } from "@medusajs/framework/http"

// Pre-registered for T08 (POST /admin/products/full and the
// additional_data.brand_id validator) so parallel tasks don't edit the same
// lines of src/api/middlewares.ts.
export const adminProductRoutesMiddlewares: MiddlewareRoute[] = []
