import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
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
  let id: string

  try {
    const { result } = await createMetafieldDefinitionWorkflow(req.scope).run({
      input: req.validatedBody,
    })
    id = result.id
  } catch (error) {
    // Medusa's error handler replaces every CONFLICT message with a generic
    // idempotency hint, which would hide which existing values don't fit.
    if ((error as MedusaError)?.type === MedusaError.Types.CONFLICT) {
      res.status(409).json({
        type: MedusaError.Types.CONFLICT,
        message: (error as MedusaError).message,
      })
      return
    }

    throw error
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [metafield_definition],
  } = await query.graph({
    entity: "metafield_definition",
    fields: req.queryConfig.fields,
    filters: { id },
  })

  res.json({ metafield_definition })
}
