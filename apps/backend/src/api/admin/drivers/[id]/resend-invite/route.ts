import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resendDriverInviteWorkflow } from "../../../../../workflows/driver/resend-driver-invite"
import {
  AdminGetDriverParamsType,
  AdminResendDriverInviteType,
} from "../../validators"

export const POST = async (
  req: AuthenticatedMedusaRequest<
    AdminResendDriverInviteType,
    AdminGetDriverParamsType
  >,
  res: MedusaResponse
) => {
  await resendDriverInviteWorkflow(req.scope).run({
    input: { driver_id: req.params.id },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [driver],
  } = await query.graph({
    entity: "driver",
    fields: req.queryConfig.fields,
    filters: { id: req.params.id },
  })

  res.json({ driver })
}
