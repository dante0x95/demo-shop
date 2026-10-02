import {
  authenticate,
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { retrieveDriverTransformQueryConfig } from "./query-config"
import { CreateDriver, GetDriverParams } from "./validators"

export const driverRoutesMiddlewares: MiddlewareRoute[] = [
  {
    // Registration: the token belongs to a driver auth identity that has no
    // driver yet, so unregistered identities are allowed on this route only.
    method: ["POST"],
    matcher: "/drivers",
    middlewares: [
      authenticate("driver", ["session", "bearer"], {
        allowUnregistered: true,
      }),
      validateAndTransformBody(CreateDriver),
      validateAndTransformQuery(
        GetDriverParams,
        retrieveDriverTransformQueryConfig
      ),
    ],
  },
]
