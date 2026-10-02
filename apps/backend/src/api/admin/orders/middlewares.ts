import { MiddlewareRoute } from "@medusajs/framework/http"

// Pre-registered for T15 (POST /admin/orders/:id/assign-driver) so parallel
// tasks don't edit the same lines of src/api/middlewares.ts.
export const adminOrderRoutesMiddlewares: MiddlewareRoute[] = []
