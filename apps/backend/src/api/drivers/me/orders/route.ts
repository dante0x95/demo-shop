import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { RemoteQueryFunction } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import OrderDriverLink from "../../../../links/order-driver"
import { GetDriverOrdersParamsType } from "../../validators"

// Ids of the given orders that have a delivered fulfillment. Fulfillments
// live in another module, so the order-fulfillment link is read first and the
// fulfillments are then filtered by `delivered_at` in the database.
const getDeliveredOrderIds = async (
  query: Omit<RemoteQueryFunction, symbol>,
  orderIds: string[]
): Promise<Set<string>> => {
  const { data: fulfillmentLinks } = await query.graph({
    entity: "order_fulfillment",
    fields: ["order_id", "fulfillment_id"],
    filters: { order_id: orderIds },
  })

  if (!fulfillmentLinks.length) {
    return new Set()
  }

  const { data: deliveredFulfillments } = await query.graph({
    entity: "fulfillment",
    fields: ["id"],
    filters: {
      id: fulfillmentLinks.map((link) => link.fulfillment_id),
      delivered_at: { $ne: null },
    },
  })

  const deliveredFulfillmentIds = new Set(
    deliveredFulfillments.map((fulfillment) => fulfillment.id)
  )

  return new Set(
    fulfillmentLinks
      .filter((link) => deliveredFulfillmentIds.has(link.fulfillment_id))
      .map((link) => link.order_id)
  )
}

export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, GetDriverOrdersParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { delivery_status } = req.validatedQuery
  const { skip = 0, take = 0 } = req.queryConfig.pagination ?? {}

  const {
    data: [driver],
  } = await query.graph({
    entity: "driver",
    fields: ["id"],
    filters: { id: req.auth_context.actor_id },
  })

  // The token can outlive its driver (e.g. a soft-deleted driver).
  if (!driver) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Driver not found")
  }

  // Only the caller's active links: a reassigned order belongs to the new
  // driver and drops out of this list.
  const { data: driverLinks } = await query.graph({
    entity: OrderDriverLink.entryPoint,
    fields: ["order_id"],
    filters: { driver_id: driver.id },
  })

  let orderIds: string[] = driverLinks.map((link) => link.order_id)

  if (delivery_status && orderIds.length) {
    const deliveredOrderIds = await getDeliveredOrderIds(query, orderIds)
    const wantDelivered = delivery_status === "delivered"

    orderIds = orderIds.filter(
      (id) => deliveredOrderIds.has(id) === wantDelivered
    )
  }

  if (!orderIds.length) {
    res.json({ orders: [], count: 0, offset: skip, limit: take })
    return
  }

  // Orders placed together can share `created_at`, so `id` breaks ties and
  // keeps pages from skipping or repeating them.
  const order = req.queryConfig.pagination?.order ?? {}

  const { data: orders, metadata } = await query.graph({
    entity: "order",
    fields: req.queryConfig.fields,
    filters: { id: orderIds },
    pagination: {
      ...req.queryConfig.pagination,
      order: { ...order, id: order.id ?? "DESC" },
    },
  })

  res.json({
    orders,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? skip,
    limit: metadata?.take ?? take,
  })
}
