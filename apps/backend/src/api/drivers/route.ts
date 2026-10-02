import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createDriverAccountWorkflow } from "../../workflows/driver/create-driver-account"
import { CreateDriverType, GetDriverParamsType } from "./validators"

export const POST = async (
  req: AuthenticatedMedusaRequest<CreateDriverType, GetDriverParamsType>,
  res: MedusaResponse
) => {
  const { result } = await createDriverAccountWorkflow(req.scope).run({
    input: {
      auth_identity_id: req.auth_context.auth_identity_id,
      driver: req.validatedBody,
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [driver],
  } = await query.graph({
    entity: "driver",
    fields: req.queryConfig.fields,
    filters: { id: result.id },
  })

  res.json({ driver })
}
