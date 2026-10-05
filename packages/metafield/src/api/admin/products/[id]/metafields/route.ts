import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { setProductMetafieldsWorkflow } from "../../../../../workflows/metafield/set-product-metafields"
import { retrieveAdminProductMetafields } from "./helpers"
import { AdminSetProductMetafieldsType } from "./validators"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const metafields = await retrieveAdminProductMetafields(
    req.scope,
    req.params.id
  )

  res.json({ metafields })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSetProductMetafieldsType>,
  res: MedusaResponse
) => {
  await setProductMetafieldsWorkflow(req.scope).run({
    input: { product_id: req.params.id, metafields: req.validatedBody.metafields },
  })

  const metafields = await retrieveAdminProductMetafields(
    req.scope,
    req.params.id
  )

  res.json({ metafields })
}
