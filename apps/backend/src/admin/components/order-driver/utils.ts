// Type-only imports: this file stays free of the SDK so unit tests can load it.
import type { OrderDriverFulfillment } from "../../lib/order-driver"

export type OrderDeliveryStatus = "pending" | "partial" | "delivered"

type FulfillmentLike = Pick<
  OrderDriverFulfillment,
  "delivered_at" | "canceled_at"
> | null

// Same rule as the driver app (confirm-delivery, collect-payment): canceled
// fulfillments are ignored. Delivered = at least one fulfillment left and all
// of them have `delivered_at`; partial = some but not all; pending = none
// (or no fulfillments at all).
export const orderDeliveryStatus = (
  fulfillments: FulfillmentLike[] | null | undefined
): OrderDeliveryStatus => {
  const active = (fulfillments ?? []).filter(
    (fulfillment): fulfillment is NonNullable<FulfillmentLike> =>
      !!fulfillment && !fulfillment.canceled_at
  )
  const delivered = active.filter((fulfillment) => fulfillment.delivered_at)

  if (delivered.length === 0) {
    return "pending"
  }

  return delivered.length === active.length ? "delivered" : "partial"
}

export const DELIVERY_STATUS_BADGES: Record<
  OrderDeliveryStatus,
  { label: string; color: "green" | "orange" | "blue" }
> = {
  pending: { label: "Pending delivery", color: "orange" },
  partial: { label: "Partially delivered", color: "blue" },
  delivered: { label: "Delivered", color: "green" },
}

// Mirror of the assign-driver workflow's order checks (validate-driver-
// assignment step); keep both in sync.
const ASSIGNABLE_ORDER_STATUSES = ["pending", "requires_action"]

// Why the API would refuse any driver for this order, or null when it can
// take one. An inactive driver is not covered: that depends on the driver and
// the picker shows the API's 400 for it.
export const assignDriverBlockedReason = (order: {
  status: string
  fulfillments:
    | (Pick<OrderDriverFulfillment, "delivered_at"> | null)[]
    | null
    | undefined
}): string | null => {
  if (!ASSIGNABLE_ORDER_STATUSES.includes(order.status)) {
    return `A driver can't be assigned to a ${order.status.replace(/_/g, " ")} order`
  }

  // Any fulfillment counts here, canceled or not, as the API does.
  if (order.fulfillments?.some((fulfillment) => fulfillment?.delivered_at)) {
    return "The order was already delivered, so its driver can't be changed"
  }

  return null
}
