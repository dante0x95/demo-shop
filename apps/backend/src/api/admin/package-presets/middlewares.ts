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
]
