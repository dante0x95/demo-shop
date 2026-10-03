import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  markOrderFulfillmentAsDeliveredWorkflow,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { resolveDeliveryFulfillmentStep } from "./steps/resolve-delivery-fulfillment"
import { validateDriverActiveStep } from "./steps/validate-driver-active"

export type ConfirmDeliveryWorkflowInput = {
  order_id: string
  driver_id: string
  fulfillment_id?: string
}

export type ConfirmDeliveryWorkflowOutput = {
  order_id: string
  // The fulfillment this run marked as delivered; null when it already was.
  fulfillment_id: string | null
}

// Part 1 of confirm-delivery: the assigned driver marks the order's
// fulfillment as delivered. Collecting the cash is part 2 (T18).
export const confirmDeliveryWorkflow = createWorkflow(
  "confirm-delivery",
  function (input: ConfirmDeliveryWorkflowInput) {
    // Same key core order flows lock on, so two confirmations (or a driver and
    // an admin) can't both read "not delivered" and deliver twice. The core
    // flow below runs as a sub-workflow, which skips its own lock steps.
    acquireLockStep({ key: input.order_id, timeout: 2, ttl: 10 })

    const { data: drivers } = useQueryGraphStep({
      entity: "driver",
      fields: ["id", "is_active"],
      filters: { id: input.driver_id },
    }).config({ name: "get-driver" })

    // A driver deactivated after being assigned delivers nothing (403), for
    // any order id, so the answer doesn't depend on which orders exist.
    validateDriverActiveStep(
      transform({ drivers }, ({ drivers }) => ({ driver: drivers[0] }))
    )

    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "status",
        "driver.id",
        "fulfillments.id",
        "fulfillments.delivered_at",
        "fulfillments.canceled_at",
      ],
      filters: { id: input.order_id },
    }).config({ name: "get-order" })

    const fulfillmentId = resolveDeliveryFulfillmentStep(
      transform({ input, drivers, orders }, ({ input, drivers, orders }) => ({
        driver_id: input.driver_id,
        order_id: input.order_id,
        fulfillment_id: input.fulfillment_id,
        driver: drivers[0],
        order: orders[0],
      }))
    )

    when("deliver-fulfillment", { fulfillmentId }, ({ fulfillmentId }) => {
      return !!fulfillmentId
    }).then(() => {
      markOrderFulfillmentAsDeliveredWorkflow.runAsStep({
        input: transform({ input, fulfillmentId }, ({ input, fulfillmentId }) => ({
          orderId: input.order_id,
          fulfillmentId: fulfillmentId as string,
        })),
      })
    })

    releaseLockStep({ key: input.order_id })

    return new WorkflowResponse(
      transform(
        { input, fulfillmentId },
        ({ input, fulfillmentId }): ConfirmDeliveryWorkflowOutput => ({
          order_id: input.order_id,
          fulfillment_id: fulfillmentId,
        })
      )
    )
  }
)
