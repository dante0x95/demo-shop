import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { deleteBrandWorkflow } from "../../../../workflows/brand/delete-brand"
import { updateBrandWorkflow } from "../../../../workflows/brand/update-brand"
import { AdminGetBrandParamsType, AdminUpdateBrandType } from "../validators"

export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, AdminGetBrandParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [brand],
  } = await query.graph({
    entity: "brand",
    fields: req.queryConfig.fields,
    filters: { id: req.params.id },
  })

  if (!brand) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Brand with id: ${req.params.id} was not found`
    )
  }

  res.json({ brand })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateBrandType>,
  res: MedusaResponse
) => {
  await updateBrandWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [brand],
  } = await query.graph({
    entity: "brand",
    fields: req.queryConfig.fields,
    filters: { id: req.params.id },
  })

  res.json({ brand })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await deleteBrandWorkflow(req.scope).run({
    input: { id: req.params.id },
  })

  res.json({ id: req.params.id, object: "brand", deleted: true })
}
