import { MedusaError, OrderStatus } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

type DeliveryFulfillment = {
  id: string
  delivered_at?: Date | string | null
  canceled_at?: Date | string | null
}

export type ResolveDeliveryFulfillmentStepInput = {
  driver_id: string
  order_id: string
  fulfillment_id?: string
  driver?: { id: string } | null
  order?: {
    id: string
    status: string
    driver?: { id: string } | null
    fulfillments?: (DeliveryFulfillment | null)[] | null
  } | null
}

// Picks the fulfillment a driver confirms as delivered, or null when there is
// nothing left to do (it was already delivered), which keeps the call
// idempotent. Read-only, so nothing needs compensating.
export const resolveDeliveryFulfillmentStep = createStep(
  "resolve-delivery-fulfillment",
  async ({
    driver_id,
    order_id,
    fulfillment_id,
    driver,
    order,
  }: ResolveDeliveryFulfillmentStepInput) => {
    // The token can outlive its driver (e.g. a soft-deleted driver).
    if (!driver) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Driver not found")
    }

    // Another driver's order gets the same 404 as an unknown one, so a driver
    // can't probe which order ids exist.
    if (!order || order.driver?.id !== driver_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order with id: ${order_id} was not found`
      )
    }

    if (order.status === OrderStatus.CANCELED) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order with id: ${order.id} is canceled`
      )
    }

    const fulfillments = (order.fulfillments ?? []).filter(
      (fulfillment): fulfillment is DeliveryFulfillment => !!fulfillment
    )

    if (fulfillment_id) {
      const fulfillment = fulfillments.find(({ id }) => id === fulfillment_id)

      if (!fulfillment) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Fulfillment with id: ${fulfillment_id} is not part of order ${order.id}`
        )
      }

      if (fulfillment.canceled_at) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Fulfillment with id: ${fulfillment_id} is canceled`
        )
      }

      return new StepResponse(
        fulfillment.delivered_at ? null : fulfillment.id
      )
    }

    const active = fulfillments.filter((fulfillment) => !fulfillment.canceled_at)

    if (!active.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order with id: ${order.id} has no fulfillment to deliver`
      )
    }

    const pending = active.filter((fulfillment) => !fulfillment.delivered_at)

    if (pending.length > 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order with id: ${order.id} has ${pending.length} fulfillments pending delivery; send fulfillment_id to pick one`
      )
    }

    return new StepResponse(pending[0]?.id ?? null)
  }
)
