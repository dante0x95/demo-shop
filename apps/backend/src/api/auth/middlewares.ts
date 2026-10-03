import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  driverInvitePendingError,
  isDriverInvitePending,
} from "../../workflows/driver/utils/driver-invite"

// A driver created by an admin gets their login from the invitation link.
// Until they accept it, logging in or signing up with that email points them
// to the invitation instead of a generic error.
const rejectPendingDriverInvite = async (
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) => {
  try {
    const email = (req.body as { email?: unknown } | undefined)?.email

    // Malformed bodies are left to the core route's own validation.
    if (typeof email !== "string") {
      return next()
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const {
      data: [driver],
    } = await query.graph({
      entity: "driver",
      fields: ["id", "invite.accepted_at"],
      filters: { email },
    })

    if (isDriverInvitePending(driver?.invite)) {
      return next(driverInvitePendingError())
    }

    next()
  } catch (error) {
    next(error)
  }
}

export const authDriverRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/auth/driver/emailpass",
    middlewares: [rejectPendingDriverInvite],
  },
  {
    method: ["POST"],
    matcher: "/auth/driver/emailpass/register",
    middlewares: [rejectPendingDriverInvite],
  },
]
