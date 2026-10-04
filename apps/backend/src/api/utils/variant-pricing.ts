import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  findBasePriceAmount,
  findDefaultCurrencyCode,
  StoreCurrency,
  VariantPrice,
} from "../../modules/variant-pricing/utils/variant-pricing"

// Reads shared by the admin and store routes that show compare-at prices and
// costs per item.

export const VARIANT_PRICE_FIELDS = [
  "prices.amount",
  "prices.currency_code",
  "prices.price_list_id",
  "prices.rules_count",
  "prices.min_quantity",
  "prices.max_quantity",
]

export type VariantPriceDetailValues = {
  compare_at_amount: number | null
  cost_amount: number | null
}

export const retrieveDefaultCurrencyCode = async (
  scope: MedusaContainer
): Promise<string | null> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [store],
  } = await query.graph({
    entity: "store",
    fields: [
      "id",
      "supported_currencies.currency_code",
      "supported_currencies.is_default",
    ],
    pagination: { take: 1 },
  })

  return findDefaultCurrencyCode(
    store?.supported_currencies as StoreCurrency[] | undefined
  )
}

// The stored compare-at price and cost per item of each variant that has
// them, by variant id.
export const retrieveVariantPriceDetails = async (
  scope: MedusaContainer,
  variantIds: string[]
): Promise<Map<string, VariantPriceDetailValues>> => {
  if (!variantIds.length) {
    return new Map()
  }

  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "variant_price_detail",
    fields: ["variant_id", "compare_at_amount", "cost_amount"],
    filters: { variant_id: variantIds },
  })

  return new Map(
    data.map((row) => [
      row.variant_id as string,
      {
        compare_at_amount: toAmount(row.compare_at_amount),
        cost_amount: toAmount(row.cost_amount),
      },
    ])
  )
}

// Each variant's own price in the default currency (see
// findBasePriceAmount), by variant id.
export const retrieveVariantBasePrices = async (
  scope: MedusaContainer,
  variantIds: string[],
  currencyCode: string | null
): Promise<Map<string, number | null>> => {
  if (!variantIds.length || !currencyCode) {
    return new Map()
  }

  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "variant",
    fields: ["id", ...VARIANT_PRICE_FIELDS],
    filters: { id: variantIds },
  })

  return new Map(
    data.map((variant) => [
      variant.id,
      findBasePriceAmount(
        // `prices` is a link alias the generated types don't list.
        (variant as { prices?: VariantPrice[] }).prices,
        currencyCode
      ),
    ])
  )
}

const toAmount = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value)
