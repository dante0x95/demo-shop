// Type-only imports: this file stays free of the SDK so unit tests can load it.
import type { OrderDriverFulfillment } from "../../lib/order-driver"

export type OrderDeliveryStatus = "pending" | "delivered"

// Same rule as the driver app's `delivery_status` filter and the
// assign-driver check: an order is delivered once one of its fulfillments has
// `delivered_at`. Until then it is pending, assigned or not.
export const orderDeliveryStatus = (
  fulfillments:
    | (Pick<OrderDriverFulfillment, "delivered_at"> | null)[]
    | null
    | undefined
): OrderDeliveryStatus =>
  fulfillments?.some((fulfillment) => fulfillment?.delivered_at)
    ? "delivered"
    : "pending"

export const DELIVERY_STATUS_BADGES: Record<
  OrderDeliveryStatus,
  { label: string; color: "green" | "orange" }
> = {
  pending: { label: "Pending delivery", color: "orange" },
  delivered: { label: "Delivered", color: "green" },
}
