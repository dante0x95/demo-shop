import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createMetafieldDefinitionWorkflow } from "../../../workflows/metafield/create-metafield-definition"
import {
  AdminCreateMetafieldDefinitionType,
  AdminGetMetafieldDefinitionsParamsType,
} from "./validators"

export const GET = async (
  req: AuthenticatedMedusaRequest<
    unknown,
    AdminGetMetafieldDefinitionsParamsType
  >,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { owner_type } = req.validatedQuery

  // Definitions created together share `created_at`, so `id` breaks ties and
  // keeps pages from skipping or repeating them.
  const order = req.queryConfig.pagination?.order ?? {}

  const { data: metafield_definitions, metadata } = await query.graph({
    entity: "metafield_definition",
    ...req.queryConfig,
    pagination: {
      ...req.queryConfig.pagination,
      order: { ...order, id: order.id ?? "DESC" },
    },
    filters: owner_type ? { owner_type } : {},
  })

  res.json({
    metafield_definitions,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateMetafieldDefinitionType>,
  res: MedusaResponse
) => {
  const { result } = await createMetafieldDefinitionWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [metafield_definition],
  } = await query.graph({
    entity: "metafield_definition",
    fields: req.queryConfig.fields,
    filters: { id: result.id },
  })

  res.json({ metafield_definition })
}
