import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { deleteProductMetafieldWorkflow } from "../../../../../../workflows/metafield/delete-product-metafield"

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await deleteProductMetafieldWorkflow(req.scope).run({
    input: { product_id: req.params.id, key: req.params.key },
  })

  res.json({
    key: req.params.key,
    object: "metafield",
    deleted: true,
  })
}
