import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { assignDriverWorkflow } from "../../../../../workflows/driver/assign-driver"
import { AdminAssignDriverType } from "../../validators"

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminAssignDriverType>,
  res: MedusaResponse
) => {
  await assignDriverWorkflow(req.scope).run({
    input: { order_id: req.params.id, driver_id: req.validatedBody.driver_id },
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
