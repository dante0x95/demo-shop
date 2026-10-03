import { LinkDefinition } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createRemoteLinkStep,
  dismissRemoteLinkStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { DRIVER_MODULE } from "../../modules/driver"
import { validateDriverAssignmentStep } from "./steps/validate-driver-assignment"

export type AssignDriverWorkflowInput = {
  order_id: string
  driver_id: string
}

const orderDriverLink = (orderId: string, driverId: string): LinkDefinition => ({
  [Modules.ORDER]: { order_id: orderId },
  [DRIVER_MODULE]: { driver_id: driverId },
})

export const assignDriverWorkflow = createWorkflow(
  "assign-driver",
  function (input: AssignDriverWorkflowInput) {
    // Same order lock as confirm-delivery: a driver confirming a delivery
    // must not see the order change hands between its ownership check and
    // the delivery, and a reassignment must see a delivery that just landed.
    acquireLockStep({ key: input.order_id, timeout: 2, ttl: 10 })

    // Unknown order -> 404.
    const { data: order } = useQueryGraphStep({
      entity: "order",
      fields: ["id", "status", "driver.id", "fulfillments.delivered_at"],
      filters: { id: input.order_id },
      options: { isList: false, throwIfKeyNotFound: true },
    })

    // Unknown driver -> 404.
    const { data: driver } = useQueryGraphStep({
      entity: "driver",
      fields: ["id", "is_active"],
      filters: { id: input.driver_id },
      options: { isList: false, throwIfKeyNotFound: true },
    }).config({ name: "get-driver" })

    validateDriverAssignmentStep({ order, driver })

    // Reassigning the same driver changes nothing. Otherwise the previous
    // link goes first: the link refuses a second driver on the same order.
    const links = transform({ input, order }, ({ input, order }) => {
      const currentDriverId: string | undefined = order.driver?.id

      if (currentDriverId === input.driver_id) {
        return { dismiss: [], create: [] }
      }

      return {
        dismiss: currentDriverId
          ? [orderDriverLink(input.order_id, currentDriverId)]
          : [],
        create: [orderDriverLink(input.order_id, input.driver_id)],
      }
    })

    dismissRemoteLinkStep(transform({ links }, ({ links }) => links.dismiss))
    createRemoteLinkStep(transform({ links }, ({ links }) => links.create))

    releaseLockStep({ key: input.order_id })

    return new WorkflowResponse({
      order_id: input.order_id,
      driver_id: input.driver_id,
    })
  }
)
