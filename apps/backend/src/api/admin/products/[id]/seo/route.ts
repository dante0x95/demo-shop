import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { updateProductSeoWorkflow } from "../../../../../workflows/seo/update-product-seo"
import { retrieveAdminProductSeo } from "./helpers"
import { AdminUpdateProductSeoType } from "./validators"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const product_seo = await retrieveAdminProductSeo(req.scope, req.params.id)

  res.json({ product_seo })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateProductSeoType>,
  res: MedusaResponse
) => {
  await updateProductSeoWorkflow(req.scope).run({
    input: { ...req.validatedBody, product_id: req.params.id },
  })

  const product_seo = await retrieveAdminProductSeo(req.scope, req.params.id)

  res.json({ product_seo })
}
