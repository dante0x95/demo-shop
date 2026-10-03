import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { setRegionsPaymentProvidersStep } from "@medusajs/medusa/core-flows"
import {
  CashOnDeliveryRegion,
  resolveCashOnDeliveryRegionsStep,
} from "./steps/resolve-cash-on-delivery-regions"

// Medusa's built-in manual provider: the payment is captured by hand, which
// is what a driver collecting cash on delivery needs.
export const CASH_ON_DELIVERY_PROVIDER_ID = "pp_system_default"

export type EnableCashOnDeliveryWorkflowInput = {
  region_ids?: string[]
}

export const enableCashOnDeliveryWorkflow = createWorkflow(
  "enable-cash-on-delivery",
  function (input: EnableCashOnDeliveryWorkflowInput) {
    const regions = resolveCashOnDeliveryRegionsStep(input)

    // Regions that already have the provider are left alone, so running it
    // again changes nothing. The others keep their current providers: the
    // core step sets the full list and would drop any provider left out.
    const plan = transform({ regions }, ({ regions }) => {
      const missing = regions.filter(
        (region: CashOnDeliveryRegion) =>
          !region.payment_provider_ids.includes(CASH_ON_DELIVERY_PROVIDER_ID)
      )

      return {
        updates: missing.map((region: CashOnDeliveryRegion) => ({
          id: region.id,
          payment_providers: [
            ...region.payment_provider_ids,
            CASH_ON_DELIVERY_PROVIDER_ID,
          ],
        })),
        enabled_region_ids: missing.map(
          (region: CashOnDeliveryRegion) => region.id
        ),
        unchanged_region_ids: regions
          .filter((region: CashOnDeliveryRegion) => !missing.includes(region))
          .map((region: CashOnDeliveryRegion) => region.id),
      }
    })

    // Fails with NOT_FOUND if the provider isn't registered or is disabled.
    setRegionsPaymentProvidersStep({
      input: transform({ plan }, ({ plan }) => plan.updates),
    })

    return new WorkflowResponse({
      provider_id: CASH_ON_DELIVERY_PROVIDER_ID,
      enabled_region_ids: transform(
        { plan },
        ({ plan }) => plan.enabled_region_ids
      ),
      unchanged_region_ids: transform(
        { plan },
        ({ plan }) => plan.unchanged_region_ids
      ),
    })
  }
)
