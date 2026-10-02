import { MedusaError, OrderStatus } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export const DRIVER_ASSIGNABLE_ORDER_STATUSES: string[] = [
  OrderStatus.PENDING,
  OrderStatus.REQUIRES_ACTION,
]

export type ValidateDriverAssignmentStepInput = {
  order: {
    id: string
    status: string
    fulfillments?: ({ delivered_at?: Date | string | null } | null)[] | null
  }
  driver: {
    id: string
    is_active: boolean
  }
}

// Read-only, so nothing needs compensating.
export const validateDriverAssignmentStep = createStep(
  "validate-driver-assignment",
  async ({ order, driver }: ValidateDriverAssignmentStepInput) => {
    if (!DRIVER_ASSIGNABLE_ORDER_STATUSES.includes(order.status)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order with id: ${order.id} is ${order.status}; a driver can only be assigned to a ${DRIVER_ASSIGNABLE_ORDER_STATUSES.join(" or ")} order`
      )
    }

    // Medusa keeps a delivered order pending, so the status alone doesn't
    // tell whether the delivery (and its cash collection) already happened.
    if (order.fulfillments?.some((fulfillment) => fulfillment?.delivered_at)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order with id: ${order.id} was already delivered`
      )
    }

    if (!driver.is_active) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Driver with id: ${driver.id} is not active`
      )
    }

    return new StepResponse(undefined)
  }
)
