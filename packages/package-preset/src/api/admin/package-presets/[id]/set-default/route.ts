import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { setDefaultPackagePresetWorkflow } from "../../../../../workflows/package-preset/set-default-package-preset"
import {
  AdminGetPackagePresetParamsType,
  AdminSetDefaultPackagePresetType,
} from "../../validators"

export const POST = async (
  req: AuthenticatedMedusaRequest<
    AdminSetDefaultPackagePresetType,
    AdminGetPackagePresetParamsType
  >,
  res: MedusaResponse
) => {
  try {
    await setDefaultPackagePresetWorkflow(req.scope).run({
      input: { id: req.params.id },
    })
  } catch (error) {
    // Medusa's error handler replaces every CONFLICT message with a generic
    // idempotency hint, which would hide that a concurrent default won.
    if ((error as MedusaError)?.type === MedusaError.Types.CONFLICT) {
      res.status(409).json({
        type: MedusaError.Types.CONFLICT,
        message: (error as MedusaError).message,
      })
      return
    }

    throw error
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [package_preset],
  } = await query.graph({
    entity: "package_preset",
    fields: req.queryConfig.fields,
    filters: { id: req.params.id },
  })

  res.json({ package_preset })
}
