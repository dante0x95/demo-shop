import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { acceptDriverInviteWorkflow } from "../../../../workflows/driver/accept-driver-invite"
import { getDriverInviteErrorResponse } from "../../invite-error-response"
import { defaultDriverFields } from "../../query-config"
import { AcceptDriverInviteType } from "../../validators"

// Public: the emailed token is the credential. Afterwards the driver logs in
// with POST /auth/driver/emailpass.
// 404 unknown link · 409 already accepted, or the email's login belongs to
// another role · 410 expired, revoked or replaced link.
export const POST = async (
  req: MedusaRequest<AcceptDriverInviteType>,
  res: MedusaResponse
) => {
  let driverId: string

  try {
    const { result } = await acceptDriverInviteWorkflow(req.scope).run({
      input: req.validatedBody,
    })
    driverId = result.id
  } catch (error) {
    const response = getDriverInviteErrorResponse(error)

    if (response) {
      res.status(response.status).json(response.body)
      return
    }

    throw error
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [driver],
  } = await query.graph({
    entity: "driver",
    fields: defaultDriverFields,
    filters: { id: driverId },
  })

  res.json({ driver })
}
