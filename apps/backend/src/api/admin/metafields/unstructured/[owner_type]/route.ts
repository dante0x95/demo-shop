import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { listUnstructuredMetafieldKeysWorkflow } from "../../../../../workflows/metafield/list-unstructured-metafield-keys"
import { AdminGetUnstructuredMetafieldsParamsType } from "../../validators"

// Keys of an owner type that have values but no definition.
export const GET = async (
  req: AuthenticatedMedusaRequest<
    unknown,
    AdminGetUnstructuredMetafieldsParamsType
  >,
  res: MedusaResponse
) => {
  const { skip = 0, take = 20 } = req.queryConfig.pagination ?? {}

  const {
    result: { keys, count },
  } = await listUnstructuredMetafieldKeysWorkflow(req.scope).run({
    input: { owner_type: req.params.owner_type, skip, take },
  })

  res.json({
    unstructured_metafields: keys.map((key) => ({
      owner_type: req.params.owner_type,
      ...key,
    })),
    count,
    offset: skip,
    limit: take,
  })
}
