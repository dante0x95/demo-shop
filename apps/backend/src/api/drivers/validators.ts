import { z } from "@medusajs/framework/zod"
import {
  createFindParams,
  createSelectParams,
} from "@medusajs/medusa/api/utils/validators"
import { DRIVER_VEHICLE_TYPES } from "../../modules/driver/models/driver"

export const GetDriverParams = createSelectParams()

export type GetDriverParamsType = z.infer<typeof GetDriverParams>

export const GetDriverMeParams = z.strictObject({
  ...createSelectParams().shape,
})

export type GetDriverMeParamsType = z.infer<typeof GetDriverMeParams>

// `delivered`: the order has a fulfillment with `delivered_at` set (the same
// rule that stops a delivered order from being reassigned). `pending`: it has
// none yet.
export const DRIVER_ORDER_DELIVERY_STATUSES = ["pending", "delivered"] as const

// `with_deleted` is left out: a driver never sees deleted orders.
export const GetDriverOrdersParams = z.strictObject({
  ...createFindParams({ limit: 20, offset: 0, order: "-created_at" }).omit({
    with_deleted: true,
  }).shape,
  delivery_status: z.enum(DRIVER_ORDER_DELIVERY_STATUSES).optional(),
})

export type GetDriverOrdersParamsType = z.infer<typeof GetDriverOrdersParams>

export const GetDriverOrderParams = z.strictObject({
  ...createSelectParams().shape,
})

export type GetDriverOrderParamsType = z.infer<typeof GetDriverOrderParams>

// `fulfillment_id` is only needed when the order has several fulfillments
// waiting for delivery; with one, the route picks it.
export const ConfirmDriverOrderDelivery = z.strictObject({
  fulfillment_id: z.string().trim().min(1).optional(),
})

export type ConfirmDriverOrderDeliveryType = z.infer<
  typeof ConfirmDriverOrderDelivery
>

// Nothing to send: the driver collects the full amount of the order's cash on
// delivery payment.
export const CollectDriverOrderPayment = z.strictObject({})

export type CollectDriverOrderPaymentType = z.infer<
  typeof CollectDriverOrderPayment
>

// email comes from the auth identity and is_active is set by admins, so
// neither is accepted here.
export const CreateDriver = z.strictObject({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  vehicle_type: z.enum(DRIVER_VEHICLE_TYPES),
  license_plate: z.string().trim().min(1).nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})

export type CreateDriverType = z.infer<typeof CreateDriver>

// The token comes from the invitation link; the password becomes the
// driver's emailpass password.
export const AcceptDriverInvite = z.strictObject({
  token: z.string().trim().min(1),
  password: z.string().min(1),
})

export type AcceptDriverInviteType = z.infer<typeof AcceptDriverInvite>
