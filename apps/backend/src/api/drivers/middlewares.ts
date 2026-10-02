import {
  authenticate,
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { retrieveDriverTransformQueryConfig } from "./query-config"
import { CreateDriver, GetDriverMeParams, GetDriverParams } from "./validators"

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
  {
    // Every /drivers/me* route needs a registered driver (actor_id = driver.id).
    matcher: "/drivers/me*",
    middlewares: [authenticate("driver", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/drivers/me",
    middlewares: [
      validateAndTransformQuery(
        GetDriverMeParams,
        retrieveDriverTransformQueryConfig
      ),
    ],
  },
]
