import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createBrandWorkflow } from "../../../workflows/brand/create-brand"
import { AdminCreateBrandType, AdminGetBrandsParamsType } from "./validators"

export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, AdminGetBrandsParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: brands, metadata } = await query.graph({
    entity: "brand",
    ...req.queryConfig,
  })

  res.json({
    brands,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateBrandType>,
  res: MedusaResponse
) => {
  const { result } = await createBrandWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [brand],
  } = await query.graph({
    entity: "brand",
    fields: req.queryConfig.fields,
    filters: { id: result.id },
  })

  res.json({ brand })
}
