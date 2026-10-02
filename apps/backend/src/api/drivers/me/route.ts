import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { GetDriverMeParamsType } from "../validators"

export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, GetDriverMeParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [driver],
  } = await query.graph({
    entity: "driver",
    fields: req.queryConfig.fields,
    filters: { id: req.auth_context.actor_id },
  })

  // The token can outlive its driver (e.g. a soft-deleted driver).
  if (!driver) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Driver not found")
  }

  res.json({ driver })
}
