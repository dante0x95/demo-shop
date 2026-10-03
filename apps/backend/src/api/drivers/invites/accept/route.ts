import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { acceptDriverInviteWorkflow } from "../../../../workflows/driver/accept-driver-invite"
import { defaultDriverFields } from "../../query-config"
import { AcceptDriverInviteType } from "../../validators"

// Public: the emailed token is the credential. Afterwards the driver logs in
// with POST /auth/driver/emailpass.
export const POST = async (
  req: MedusaRequest<AcceptDriverInviteType>,
  res: MedusaResponse
) => {
  const { result } = await acceptDriverInviteWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [driver],
  } = await query.graph({
    entity: "driver",
    fields: defaultDriverFields,
    filters: { id: result.id },
  })

  res.json({ driver })
}
