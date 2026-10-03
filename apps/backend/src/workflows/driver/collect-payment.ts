import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  capturePaymentWorkflow,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { resolveCollectablePaymentStep } from "./steps/resolve-collectable-payment"
import { validateDriverActiveStep } from "./steps/validate-driver-active"

export type CollectPaymentWorkflowInput = {
  order_id: string
  driver_id: string
}

export type CollectPaymentWorkflowOutput = {
  order_id: string
  payment_id: string
}

// Part 2 of confirm-delivery: once the order is delivered, the assigned driver
// collects the cash, which captures the order's manual payment.
export const collectPaymentWorkflow = createWorkflow(
  "collect-payment",
  function (input: CollectPaymentWorkflowInput) {
    // Same key as confirm-delivery and core order flows, so two collections
    // can't both read "not captured", and a reassignment or delivery can't
    // slip in between the checks and the capture.
    acquireLockStep({ key: input.order_id, timeout: 2, ttl: 10 })

    const { data: drivers } = useQueryGraphStep({
      entity: "driver",
      fields: ["id", "is_active"],
      filters: { id: input.driver_id },
    }).config({ name: "get-driver" })

    // A deactivated driver collects nothing (403), for any order id, so the
    // answer doesn't depend on which orders exist.
    validateDriverActiveStep(
      transform({ drivers }, ({ drivers }) => ({ driver: drivers[0] }))
    )

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "status",
        "driver.id",
        "fulfillments.delivered_at",
        "fulfillments.canceled_at",
        "payment_collections.payments.id",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
      ],
      filters: { id: input.order_id },
    }).config({ name: "get-order" })

    const paymentId = resolveCollectablePaymentStep(
      transform({ input, orders }, ({ input, orders }) => ({
        driver_id: input.driver_id,
        order_id: input.order_id,
        order: orders[0],
      }))
    )

    // Captures the full amount and records it on the order. Core leaves the
    // capture uncompensated on purpose: undoing it is a refund, an admin call.
    capturePaymentWorkflow.runAsStep({
      input: transform({ input, paymentId }, ({ input, paymentId }) => ({
        payment_id: paymentId,
        captured_by: input.driver_id,
      })),
    })

    releaseLockStep({ key: input.order_id })

    return new WorkflowResponse(
      transform(
        { input, paymentId },
        ({ input, paymentId }): CollectPaymentWorkflowOutput => ({
          order_id: input.order_id,
          payment_id: paymentId,
        })
      )
    )
  }
)
