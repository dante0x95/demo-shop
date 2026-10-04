import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { setProductPackagePresetWorkflow } from "../../../../../workflows/package-preset/set-product-package-preset"
import { AdminSetProductPackagePresetType } from "../../../package-presets/validators"
import { retrieveAdminProductPackagePreset } from "./helpers"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const product_package_preset = await retrieveAdminProductPackagePreset(
    req.scope,
    req.params.id
  )

  res.json({ product_package_preset })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSetProductPackagePresetType>,
  res: MedusaResponse
) => {
  await setProductPackagePresetWorkflow(req.scope).run({
    input: {
      product_id: req.params.id,
      package_preset_id: req.validatedBody.package_preset_id,
    },
  })

  const product_package_preset = await retrieveAdminProductPackagePreset(
    req.scope,
    req.params.id
  )

  res.json({ product_package_preset })
}
