import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  driverInviteGateError,
  getDriverInviteGate,
} from "../../workflows/driver/utils/driver-invite"

// A driver created by an admin gets their login from the invitation link.
// Until they accept it, logging in or signing up with that email answers 403
// and points them to the invitation, or, once it expired, to the store for a
// new one (T14.2).
const rejectUnacceptedDriverInvite = async (
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
      fields: ["id", "invites.status", "invites.expires_at"],
      filters: { email },
    })

    const gate = getDriverInviteGate(driver?.invites, new Date())

    if (gate) {
      return next(driverInviteGateError(gate))
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
    middlewares: [rejectUnacceptedDriverInvite],
  },
  {
    method: ["POST"],
    matcher: "/auth/driver/emailpass/register",
    middlewares: [rejectUnacceptedDriverInvite],
  },
]
