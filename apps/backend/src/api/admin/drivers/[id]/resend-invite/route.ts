import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resendDriverInviteWorkflow } from "../../../../../workflows/driver/resend-driver-invite"
import { getDriverInviteErrorResponse } from "../../../../drivers/invite-error-response"
import {
  AdminGetDriverParamsType,
  AdminResendDriverInviteType,
} from "../../validators"

// 201: a new invitation is created. 409 when the driver already has a login.
export const POST = async (
  req: AuthenticatedMedusaRequest<
    AdminResendDriverInviteType,
    AdminGetDriverParamsType
  >,
  res: MedusaResponse
) => {
  try {
    await resendDriverInviteWorkflow(req.scope).run({
      input: { driver_id: req.params.id },
    })
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
    fields: req.queryConfig.fields,
    filters: { id: req.params.id },
  })

  res.status(201).json({ driver })
}
