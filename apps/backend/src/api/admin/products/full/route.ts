import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductFullWorkflow } from "../../../../workflows/create-product-full"
import { AdminCreateProductFullType } from "./validators"

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateProductFullType>,
  res: MedusaResponse
) => {
  const { additional_data, status, ...product } = req.validatedBody

  const { result } = await createProductFullWorkflow(req.scope).run({
    input: {
      // The core schema accepts `status: null`; leaving it unset lets the
      // product module apply its default (draft).
      product: { ...product, status: status ?? undefined },
      additional_data: additional_data ?? undefined,
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [created],
  } = await query.graph({
    entity: "product",
    fields: req.queryConfig.fields,
    filters: { id: result.id },
  })

  res.json({ product: created })
}
