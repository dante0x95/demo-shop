import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StoreGetBrandsParamsType } from "./validators"

// Escapes LIKE wildcards so `q` is matched literally.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

export const GET = async (
  req: MedusaRequest<unknown, StoreGetBrandsParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { q, handle } = req.validatedQuery

  const filters: Record<string, unknown> = { is_active: true }

  if (handle) {
    filters.handle = handle
  }

  if (q) {
    filters.name = { $ilike: `%${escapeLike(q)}%` }
  }

  const { data: brands, metadata } = await query.graph({
    entity: "brand",
    ...req.queryConfig,
    filters,
  })

  res.json({
    brands,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  })
}
