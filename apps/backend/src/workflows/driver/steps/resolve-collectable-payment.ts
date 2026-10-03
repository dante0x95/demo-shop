import { MedusaError, OrderStatus } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { CASH_ON_DELIVERY_PROVIDER_ID } from "../../payment/enable-cash-on-delivery"

type CollectableFulfillment = {
  delivered_at?: Date | string | null
  canceled_at?: Date | string | null
}

type CollectablePayment = {
  id: string
  provider_id: string
  captured_at?: Date | string | null
  canceled_at?: Date | string | null
}

export type ResolveCollectablePaymentStepInput = {
  driver_id: string
  order_id: string
  order?: {
    id: string
    status: string
    driver?: { id: string } | null
    fulfillments?: (CollectableFulfillment | null)[] | null
    payment_collections?:
      | ({ payments?: (CollectablePayment | null)[] | null } | null)[]
      | null
  } | null
}

// Picks the cash on delivery payment the driver collects. Read-only, so
// nothing needs compensating.
export const resolveCollectablePaymentStep = createStep(
  "resolve-collectable-payment",
  async ({ driver_id, order_id, order }: ResolveCollectablePaymentStepInput) => {
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

    // Cash is collected on delivery: every fulfillment still in play must be
    // delivered, and there must be at least one.
    const fulfillments = (order.fulfillments ?? []).filter(
      (fulfillment): fulfillment is CollectableFulfillment =>
        !!fulfillment && !fulfillment.canceled_at
    )

    if (
      !fulfillments.length ||
      fulfillments.some((fulfillment) => !fulfillment.delivered_at)
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order with id: ${order.id} is not delivered yet`
      )
    }

    // Only the manual provider is cash; a card payment is never the driver's
    // to capture.
    const payments = (order.payment_collections ?? [])
      .flatMap((collection) => collection?.payments ?? [])
      .filter(
        (payment): payment is CollectablePayment =>
          !!payment &&
          !payment.canceled_at &&
          payment.provider_id === CASH_ON_DELIVERY_PROVIDER_ID
      )

    if (!payments.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order with id: ${order.id} has no cash on delivery payment to collect`
      )
    }

    const pending = payments.filter((payment) => !payment.captured_at)

    if (!pending.length) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `The payment of order with id: ${order.id} was already collected`
      )
    }

    if (pending.length > 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order with id: ${order.id} has ${pending.length} cash on delivery payments to collect; an admin must capture them`
      )
    }

    return new StepResponse(pending[0].id)
  }
)
