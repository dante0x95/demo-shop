import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createDriverWorkflow } from "../../../workflows/driver/create-driver"
import { getDriverInviteErrorResponse } from "../../drivers/invite-error-response"
import {
  AdminCreateDriverType,
  AdminGetDriverParamsType,
  AdminGetDriversParamsType,
} from "./validators"

export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, AdminGetDriversParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { is_active } = req.validatedQuery

  // Drivers created together share `created_at`, so `id` breaks ties and
  // keeps pages from skipping or repeating them.
  const order = req.queryConfig.pagination?.order ?? {}

  const { data: drivers, metadata } = await query.graph({
    entity: "driver",
    ...req.queryConfig,
    pagination: {
      ...req.queryConfig.pagination,
      order: { ...order, id: order.id ?? "DESC" },
    },
    filters: is_active === undefined ? {} : { is_active },
  })

  res.json({
    drivers,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<
    AdminCreateDriverType,
    AdminGetDriverParamsType
  >,
  res: MedusaResponse
) => {
  let driverId: string

  try {
    const { result } = await createDriverWorkflow(req.scope).run({
      input: req.validatedBody,
    })
    driverId = result.id
  } catch (error) {
    // 409 when the email's login belongs to an admin or a customer.
    const response = getDriverInviteErrorResponse(error)

    if (response) {
      res.status(response.status).json(response.body)
      return
    }

    throw error
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [driver],
  } = await query.graph({
    entity: "driver",
    fields: req.queryConfig.fields,
    filters: { id: driverId },
  })

  res.json({ driver })
}
