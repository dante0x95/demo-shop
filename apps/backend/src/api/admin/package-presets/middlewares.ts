import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  listPackagePresetsTransformQueryConfig,
  retrievePackagePresetTransformQueryConfig,
} from "./query-config"
import {
  AdminCreatePackagePreset,
  AdminGetPackagePresetParams,
  AdminGetPackagePresetsParams,
  AdminSetDefaultPackagePreset,
  AdminSetProductPackagePreset,
} from "./validators"

export const adminPackagePresetRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/package-presets",
    middlewares: [
      validateAndTransformQuery(
        AdminGetPackagePresetsParams,
        listPackagePresetsTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/package-presets",
    middlewares: [
      validateAndTransformBody(AdminCreatePackagePreset),
      validateAndTransformQuery(
        AdminGetPackagePresetParams,
        retrievePackagePresetTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/package-presets/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetPackagePresetParams,
        retrievePackagePresetTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/package-presets/:id/set-default",
    middlewares: [
      validateAndTransformBody(AdminSetDefaultPackagePreset),
      validateAndTransformQuery(
        AdminGetPackagePresetParams,
        retrievePackagePresetTransformQueryConfig
      ),
    ],
  },
]

// The product's preset route lives under admin/products (file-based routing),
// but its validation is package-preset code and moves with the module when it
// becomes a plugin.
export const adminProductPackagePresetMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/products/:id/package-preset",
    middlewares: [validateAndTransformBody(AdminSetProductPackagePreset)],
  },
]
