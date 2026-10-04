import type { AdminDriver } from "./drivers"
import { sdk } from "./sdk"

export type OrderDriver = Pick<
  AdminDriver,
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "vehicle_type"
  | "is_active"
>

export type OrderDriverFulfillment = {
  id: string
  delivered_at: string | null
}

// The parts of an order the driver widget shows. `driver` comes from the
// order-driver link, which core's order types don't know about.
export type AdminOrderDriverView = {
  id: string
  display_id: number
  status: string
  driver: OrderDriver | null
  fulfillments: OrderDriverFulfillment[] | null
}

const ORDER_DRIVER_FIELDS = [
  "id",
  "display_id",
  "status",
  "driver.id",
  "driver.first_name",
  "driver.last_name",
  "driver.email",
  "driver.phone",
  "driver.vehicle_type",
  "driver.is_active",
  "fulfillments.id",
  "fulfillments.delivered_at",
].join(",")

// Nested under the dashboard's own order detail key (["orders", "detail",
// id, ...]): whatever the order page does that invalidates the order (mark a
// fulfillment as delivered, cancel, ...) also refreshes the driver widget. The
// last part keeps it apart from the dashboard's `{ query }` entries.
export const orderDriverQueryKeys = {
  detail: (orderId: string) =>
    ["orders", "detail", orderId, { driver_widget: true }] as const,
}

export const retrieveOrderDriver = async (
  orderId: string
): Promise<AdminOrderDriverView> => {
  const { order } = await sdk.admin.order.retrieve(orderId, {
    fields: ORDER_DRIVER_FIELDS,
  })

  return order as unknown as AdminOrderDriverView
}

// Assigns the driver, replacing the current one. The API answers 400 with the
// reason when the order can't take a driver (canceled, completed or already
// delivered) or the driver is inactive.
export const assignOrderDriver = (orderId: string, driverId: string) =>
  sdk.client.fetch<{ order: { id: string; driver: OrderDriver | null } }>(
    `/admin/orders/${orderId}/assign-driver`,
    { method: "POST", body: { driver_id: driverId } }
  )
