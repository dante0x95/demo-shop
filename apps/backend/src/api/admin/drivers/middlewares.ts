import { MiddlewareRoute } from "@medusajs/framework/http"

// Pre-registered for T14 (GET/POST /admin/drivers) so parallel tasks don't
// edit the same lines of src/api/middlewares.ts.
export const adminDriverRoutesMiddlewares: MiddlewareRoute[] = []
