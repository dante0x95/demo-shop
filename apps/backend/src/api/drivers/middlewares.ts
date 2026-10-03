import {
  authenticate,
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  listDriverOrdersTransformQueryConfig,
  retrieveDriverOrderTransformQueryConfig,
  retrieveDriverTransformQueryConfig,
} from "./query-config"
import {
  AcceptDriverInvite,
  CollectDriverOrderPayment,
  ConfirmDriverOrderDelivery,
  CreateDriver,
  GetDriverMeParams,
  GetDriverOrderParams,
  GetDriverOrdersParams,
  GetDriverParams,
} from "./validators"

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
    // Public: the invitation token in the body is the credential.
    method: ["POST"],
    matcher: "/drivers/invites/accept",
    middlewares: [validateAndTransformBody(AcceptDriverInvite)],
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
  {
    method: ["GET"],
    matcher: "/drivers/me/orders",
    middlewares: [
      validateAndTransformQuery(
        GetDriverOrdersParams,
        listDriverOrdersTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/drivers/me/orders/:id/collect-payment",
    middlewares: [
      validateAndTransformBody(CollectDriverOrderPayment),
      validateAndTransformQuery(
        GetDriverOrderParams,
        retrieveDriverOrderTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/drivers/me/orders/:id/delivered",
    middlewares: [
      validateAndTransformBody(ConfirmDriverOrderDelivery),
      validateAndTransformQuery(
        GetDriverOrderParams,
        retrieveDriverOrderTransformQueryConfig
      ),
    ],
  },
]
