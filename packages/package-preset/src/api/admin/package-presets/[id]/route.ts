import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { deletePackagePresetWorkflow } from "../../../../workflows/package-preset/delete-package-preset"
import { AdminGetPackagePresetParamsType } from "../validators"

export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, AdminGetPackagePresetParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [package_preset],
  } = await query.graph({
    entity: "package_preset",
    fields: req.queryConfig.fields,
    filters: { id: req.params.id },
  })

  if (!package_preset) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Package preset with id: ${req.params.id} was not found`
    )
  }

  res.json({ package_preset })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await deletePackagePresetWorkflow(req.scope).run({
    input: { id: req.params.id },
  })

  res.json({
    id: req.params.id,
    object: "package_preset",
    deleted: true,
  })
}
