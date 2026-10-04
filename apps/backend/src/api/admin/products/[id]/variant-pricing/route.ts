import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { updateVariantPricingWorkflow } from "../../../../../workflows/variant-pricing/update-variant-pricing"
import { retrieveAdminVariantPricing } from "./helpers"
import { AdminUpdateVariantPricingType } from "./validators"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const variant_pricing = await retrieveAdminVariantPricing(
    req.scope,
    req.params.id
  )

  res.json({ variant_pricing })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateVariantPricingType>,
  res: MedusaResponse
) => {
  await updateVariantPricingWorkflow(req.scope).run({
    input: { product_id: req.params.id, variants: req.validatedBody.variants },
  })

  const variant_pricing = await retrieveAdminVariantPricing(
    req.scope,
    req.params.id
  )

  res.json({ variant_pricing })
}
