/**
 * Enables cash on delivery (Medusa's manual provider, `pp_system_default`) in
 * the store region.
 *
 *   npx medusa exec ./src/scripts/enable-cash-on-delivery.ts [region_id ...]
 *
 * Without arguments it targets the store's default region, or the only region
 * when no default is set; with several regions and no default it stops and
 * asks for the region ids. Idempotent: regions that already accept the
 * provider are left unchanged, and other providers are kept.
 */
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"
import { enableCashOnDeliveryWorkflow } from "../workflows/payment/enable-cash-on-delivery"

export default async function enableCashOnDelivery({
  container,
  args = [],
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionIds = args.map((arg) => arg.trim()).filter(Boolean)

  const { result } = await enableCashOnDeliveryWorkflow(container).run({
    input: { region_ids: regionIds },
  })

  if (result.enabled_region_ids.length) {
    logger.info(
      `Enabled ${result.provider_id} in regions: ${result.enabled_region_ids.join(", ")}`
    )
  }

  if (result.unchanged_region_ids.length) {
    logger.info(
      `${result.provider_id} was already enabled in regions: ${result.unchanged_region_ids.join(", ")}`
    )
  }

  return result
}
