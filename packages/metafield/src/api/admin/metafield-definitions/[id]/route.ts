import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { deleteMetafieldDefinitionWorkflow } from "../../../../workflows/metafield/delete-metafield-definition"
import { updateMetafieldDefinitionWorkflow } from "../../../../workflows/metafield/update-metafield-definition"
import {
  AdminDeleteMetafieldDefinitionParamsType,
  AdminGetMetafieldDefinitionParamsType,
  AdminUpdateMetafieldDefinitionType,
} from "../validators"

const retrieveMetafieldDefinition = async (
  req: AuthenticatedMedusaRequest<unknown, unknown>
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

  return metafield_definition
}

export const GET = async (
  req: AuthenticatedMedusaRequest<
    unknown,
    AdminGetMetafieldDefinitionParamsType
  >,
  res: MedusaResponse
) => {
  const metafield_definition = await retrieveMetafieldDefinition(req)

  res.json({ metafield_definition })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    AdminUpdateMetafieldDefinitionType,
    AdminGetMetafieldDefinitionParamsType
  >,
  res: MedusaResponse
) => {
  await updateMetafieldDefinitionWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })

  const metafield_definition = await retrieveMetafieldDefinition(req)

  res.json({ metafield_definition })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest<
    unknown,
    AdminDeleteMetafieldDefinitionParamsType
  >,
  res: MedusaResponse
) => {
  await deleteMetafieldDefinitionWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      delete_values: req.validatedQuery.delete_values ?? false,
    },
  })

  res.json({
    id: req.params.id,
    object: "metafield_definition",
    deleted: true,
  })
}
