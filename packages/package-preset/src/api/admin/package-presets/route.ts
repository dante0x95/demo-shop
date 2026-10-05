import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { createPackagePresetWorkflow } from "../../../workflows/package-preset/create-package-preset"
import {
  AdminCreatePackagePresetType,
  AdminGetPackagePresetsParamsType,
} from "./validators"

export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, AdminGetPackagePresetsParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { is_default } = req.validatedQuery

  // Presets created together share `created_at`, so `id` breaks ties and
  // keeps pages from skipping or repeating them.
  const order = req.queryConfig.pagination?.order ?? {}

  const { data: package_presets, metadata } = await query.graph({
    entity: "package_preset",
    ...req.queryConfig,
    pagination: {
      ...req.queryConfig.pagination,
      order: { ...order, id: order.id ?? "DESC" },
    },
    filters: is_default === undefined ? {} : { is_default },
  })

  res.json({
    package_presets,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreatePackagePresetType>,
  res: MedusaResponse
) => {
  let id: string

  try {
    const { result } = await createPackagePresetWorkflow(req.scope).run({
      input: req.validatedBody,
    })

    id = result.id
  } catch (error) {
    // Medusa's error handler replaces every CONFLICT message with a generic
    // idempotency hint, which would hide that a concurrent default won.
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
    data: [package_preset],
  } = await query.graph({
    entity: "package_preset",
    fields: req.queryConfig.fields,
    filters: { id },
  })

  res.json({ package_preset })
}
