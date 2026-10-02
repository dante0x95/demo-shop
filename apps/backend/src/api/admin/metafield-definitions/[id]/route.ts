import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { deleteMetafieldDefinitionWorkflow } from "../../../../workflows/metafield/delete-metafield-definition"
import { AdminGetMetafieldDefinitionParamsType } from "../validators"

export const GET = async (
  req: AuthenticatedMedusaRequest<
    unknown,
    AdminGetMetafieldDefinitionParamsType
  >,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [metafield_definition],
  } = await query.graph({
    entity: "metafield_definition",
    fields: req.queryConfig.fields,
    filters: { id: req.params.id },
  })

  if (!metafield_definition) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Metafield definition with id: ${req.params.id} was not found`
    )
  }

  res.json({ metafield_definition })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await deleteMetafieldDefinitionWorkflow(req.scope).run({
    input: { id: req.params.id },
  })

  res.json({
    id: req.params.id,
    object: "metafield_definition",
    deleted: true,
  })
}
