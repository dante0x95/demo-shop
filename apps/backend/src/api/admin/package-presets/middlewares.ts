import { MiddlewareRoute } from "@medusajs/framework/http"

// Pre-registered for T10 (GET/POST/DELETE /admin/package-presets) so parallel
// tasks don't edit the same lines of src/api/middlewares.ts.
export const adminPackagePresetRoutesMiddlewares: MiddlewareRoute[] = []
