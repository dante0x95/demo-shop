import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { deleteUnstructuredMetafieldValuesWorkflow } from "../../../../../../workflows/metafield/delete-unstructured-metafield-values"

// Deletes every value of a key without a definition, for every owner.
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { result: deletedIds } =
    await deleteUnstructuredMetafieldValuesWorkflow(req.scope).run({
      input: { owner_type: req.params.owner_type, key: req.params.key },
    })

  res.json({
    owner_type: req.params.owner_type,
    key: req.params.key,
    object: "unstructured_metafield",
    deleted: true,
    values_deleted: deletedIds.length,
  })
}
