// Pure helpers for compare-at prices and costs per item. Amounts are in the
// store's default currency: the store is single-currency.

export type StoreCurrency = {
  currency_code?: string | null
  is_default?: boolean | null
}

export type VariantPrice = {
  amount?: number | null
  currency_code?: string | null
  price_list_id?: string | null
  rules_count?: number | null
  min_quantity?: number | null
  max_quantity?: number | null
}

export type VariantPricingChanges = {
  compare_at_amount?: number | null
  cost_amount?: number | null
}

// The store's default currency code (lowercase), or null when the store has
// none marked as default.
export const findDefaultCurrencyCode = (
  currencies: (StoreCurrency | null | undefined)[] | null | undefined
): string | null => {
  const currency = (currencies ?? []).find(
    (item) => item?.is_default && item.currency_code
  )

  return currency?.currency_code?.toLowerCase() ?? null
}

// The variant's own price in `currencyCode`: the one the admin sets on the
// variant, not a price list's price, nor one limited by rules (region,
// customer group...) or by quantity. Null when it has none.
export const findBasePriceAmount = (
  prices: (VariantPrice | null | undefined)[] | null | undefined,
  currencyCode: string | null | undefined
): number | null => {
  if (!currencyCode) {
    return null
  }

  const price = (prices ?? []).find(
    (item) =>
      !!item &&
      item.currency_code?.toLowerCase() === currencyCode.toLowerCase() &&
      !item.price_list_id &&
      !item.rules_count &&
      item.min_quantity == null &&
      item.max_quantity == null &&
      item.amount != null
  )

  return price ? Number(price.amount) : null
}

// The compare-at price a storefront shows: only when it is strictly higher
// than the variant's price, so no sale is shown otherwise. Without a price
// there is nothing to compare with, so nothing is shown.
export const storefrontCompareAtAmount = (
  compareAtAmount: number | null | undefined,
  priceAmount: number | null | undefined
): number | null => {
  if (compareAtAmount == null || priceAmount == null) {
    return null
  }

  const compareAt = Number(compareAtAmount)

  return compareAt > Number(priceAmount) ? compareAt : null
}

// The fields an edit changes: a field left out keeps its stored value, null
// clears it.
export const variantPricingChanges = (
  item: VariantPricingChanges
): VariantPricingChanges => {
  const changes: VariantPricingChanges = {}

  if (item.compare_at_amount !== undefined) {
    changes.compare_at_amount = item.compare_at_amount
  }

  if (item.cost_amount !== undefined) {
    changes.cost_amount = item.cost_amount
  }

  return changes
}

// The requested variant ids that are not variants of the product, in request
// order and without repeats.
export const findVariantsNotInProduct = (
  productVariantIds: string[],
  requestedIds: string[]
): string[] => {
  const own = new Set(productVariantIds)

  return [...new Set(requestedIds)].filter((id) => !own.has(id))
}
