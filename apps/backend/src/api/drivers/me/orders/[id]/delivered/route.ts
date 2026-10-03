import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { confirmDeliveryWorkflow } from "../../../../../../workflows/driver/confirm-delivery"
import {
  ConfirmDriverOrderDeliveryType,
  GetDriverOrderParamsType,
} from "../../../../validators"

export const POST = async (
  req: AuthenticatedMedusaRequest<
    ConfirmDriverOrderDeliveryType,
    GetDriverOrderParamsType
  >,
  res: MedusaResponse
) => {
  // The driver id comes from the token, never from the request, so a driver
  // can only confirm deliveries of orders assigned to them.
  await confirmDeliveryWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      driver_id: req.auth_context.actor_id,
      fulfillment_id: req.validatedBody.fulfillment_id,
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: req.queryConfig.fields,
    filters: { id: req.params.id },
  })

  res.json({ order })
}
