import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { VARIANT_PRICING_MODULE } from "../../../modules/variant-pricing"
import VariantPricingModuleService from "../../../modules/variant-pricing/service"
import {
  variantPricingChanges,
  VariantPricingChanges,
} from "../../../modules/variant-pricing/utils/variant-pricing"

export type VariantPriceDetailInput = VariantPricingChanges & {
  variant_id: string
}

export type UpsertVariantPriceDetailsStepInput = VariantPriceDetailInput[]

type VariantPriceDetailRow = {
  id: string
  variant_id: string
  compare_at_amount: number | null
  cost_amount: number | null
}

type Compensation = {
  created_ids: string[]
  previous: Omit<VariantPriceDetailRow, "variant_id">[]
}

// Saves the fields sent for each variant; a field left out keeps its stored
// value. A variant's first edit creates its row; later edits update it. Rows
// are created in one call and updated in another, so a failed call stores
// nothing of its own.
export const upsertVariantPriceDetailsStep = createStep(
  "upsert-variant-price-details",
  async (input: UpsertVariantPriceDetailsStepInput, { container }) => {
    const service: VariantPricingModuleService = container.resolve(
      VARIANT_PRICING_MODULE
    )

    const variantIds = input.map((item) => item.variant_id)

    const findRows = async () => {
      const rows = (await service.listVariantPriceDetails(
        { variant_id: variantIds },
        { select: ["id", "variant_id", "compare_at_amount", "cost_amount"] }
      )) as unknown as VariantPriceDetailRow[]

      return new Map(rows.map((row) => [row.variant_id, row]))
    }

    const createMissing = async (rows: Map<string, VariantPriceDetailRow>) => {
      const missing = input.filter((item) => !rows.has(item.variant_id))

      if (!missing.length) {
        return []
      }

      return service.createVariantPriceDetails(
        missing.map((item) => ({
          variant_id: item.variant_id,
          compare_at_amount: null,
          cost_amount: null,
          ...variantPricingChanges(item),
        }))
      )
    }

    let rows = await findRows()
    let created: { id: string }[]

    try {
      created = await createMissing(rows)
    } catch (error) {
      // A concurrent first edit of one of these variants created its row
      // after the lookup above; the unique index rejected this batch, so the
      // rows that exist now are updated instead.
      rows = await findRows()
      created = await createMissing(rows)
    }

    const toUpdate = input.filter((item) => rows.has(item.variant_id))
    const previous = toUpdate.map((item) => {
      const { id, compare_at_amount, cost_amount } = rows.get(item.variant_id)!

      return { id, compare_at_amount, cost_amount }
    })

    if (toUpdate.length) {
      try {
        await service.updateVariantPriceDetails(
          toUpdate.map((item) => ({
            id: rows.get(item.variant_id)!.id,
            ...variantPricingChanges(item),
          }))
        )
      } catch (error) {
        // This step's own compensation doesn't run when it fails, so undo
        // the rows it created before failing.
        if (created.length) {
          await service.deleteVariantPriceDetails(created.map((row) => row.id))
        }

        throw error
      }
    }

    const compensation: Compensation = {
      created_ids: created.map((row) => row.id),
      previous,
    }

    return new StepResponse(
      { created_ids: compensation.created_ids, updated_ids: previous.map((row) => row.id) },
      compensation
    )
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }

    const service: VariantPricingModuleService = container.resolve(
      VARIANT_PRICING_MODULE
    )

    if (compensation.created_ids.length) {
      await service.deleteVariantPriceDetails(compensation.created_ids)
    }

    if (compensation.previous.length) {
      await service.updateVariantPriceDetails(compensation.previous)
    }
  }
)
