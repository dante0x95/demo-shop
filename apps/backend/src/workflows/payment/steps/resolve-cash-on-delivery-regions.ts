import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type ResolveCashOnDeliveryRegionsStepInput = {
  region_ids?: string[]
}

export type CashOnDeliveryRegion = {
  id: string
  name: string
  payment_provider_ids: string[]
}

type RegionRow = {
  id: string
  name: string
  payment_providers?: ({ id: string } | null)[] | null
}

const toCashOnDeliveryRegion = (region: RegionRow): CashOnDeliveryRegion => ({
  id: region.id,
  name: region.name,
  payment_provider_ids: (region.payment_providers ?? [])
    .filter((provider): provider is { id: string } => !!provider)
    .map((provider) => provider.id),
})

// Picks the regions that take cash on delivery, never guessing between several:
// 1. the region ids passed in, all of which must exist;
// 2. otherwise the store's default region;
// 3. otherwise the only region, when there is exactly one.
// Read-only, so nothing needs compensating.
export const resolveCashOnDeliveryRegionsStep = createStep(
  "resolve-cash-on-delivery-regions",
  async (input: ResolveCashOnDeliveryRegionsStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const regionFields = ["id", "name", "payment_providers.id"]

    const findRegions = async (ids: string[]) => {
      const { data } = await query.graph({
        entity: "region",
        fields: regionFields,
        filters: { id: ids },
      })
      return data as RegionRow[]
    }

    const requestedIds = Array.from(new Set(input.region_ids ?? []))

    if (requestedIds.length) {
      const regions = await findRegions(requestedIds)
      const foundIds = new Set(regions.map((region) => region.id))
      const missingIds = requestedIds.filter((id) => !foundIds.has(id))

      if (missingIds.length) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Regions with ids: ${missingIds.join(", ")} were not found`
        )
      }

      return new StepResponse(regions.map(toCashOnDeliveryRegion))
    }

    const { data: stores } = await query.graph({
      entity: "store",
      fields: ["id", "default_region_id"],
    })
    const defaultRegionIds = Array.from(
      new Set(
        stores
          .map((store) => store.default_region_id)
          .filter((id): id is string => !!id)
      )
    )

    if (defaultRegionIds.length) {
      const regions = await findRegions(defaultRegionIds)

      if (regions.length !== defaultRegionIds.length) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `The store's default region (${defaultRegionIds.join(", ")}) was not found`
        )
      }

      return new StepResponse(regions.map(toCashOnDeliveryRegion))
    }

    const { data: regions } = await query.graph({
      entity: "region",
      fields: regionFields,
    })

    if (!regions.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "No region exists; create the store region first"
      )
    }

    if (regions.length > 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `The store has ${regions.length} regions and no default region; pass the region ids to enable cash on delivery in`
      )
    }

    return new StepResponse((regions as RegionRow[]).map(toCashOnDeliveryRegion))
  }
)
