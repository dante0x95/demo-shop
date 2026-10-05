// Type-only imports from the SDK client: this file stays free of the SDK so
// unit tests can load it.
import type {
  AdminUpdateVariantPricingItem,
  AdminVariantPricingVariant,
} from "../../lib/variant-pricing"
import { storefrontCompareAtAmount } from "../../../modules/variant-pricing/utils/variant-pricing"

export type VariantPricingField = "compare_at_amount" | "cost_amount"

// What the admin types, per variant. An empty field means "not set".
export type VariantPricingFormRow = {
  variant_id: string
  compare_at_amount: string
  cost_amount: string
}

export type VariantPricingFormErrors = Record<
  string,
  Partial<Record<VariantPricingField, string>>
>

export const AMOUNT_ERROR = "Enter an amount of 0 or more, like 49.99"

const FIELDS: VariantPricingField[] = ["compare_at_amount", "cost_amount"]

// Plain decimal numbers only ("49.99", "0", ".5"): no signs, exponents or
// thousands separators, so what the admin sees is what is saved.
const AMOUNT_PATTERN = /^(\d+(\.\d*)?|\.\d+)$/

// The amount an input holds: null when it is empty (clears the value), or
// undefined when it is not a valid amount.
export const parseAmountInput = (input: string): number | null | undefined => {
  const value = input.trim()

  if (!value) {
    return null
  }

  return AMOUNT_PATTERN.test(value) ? Number(value) : undefined
}

const toInput = (amount: number | null) => (amount == null ? "" : String(amount))

export const toVariantPricingFormRows = (
  variants: AdminVariantPricingVariant[]
): VariantPricingFormRow[] =>
  variants.map((variant) => ({
    variant_id: variant.variant_id,
    compare_at_amount: toInput(variant.compare_at_amount),
    cost_amount: toInput(variant.cost_amount),
  }))

// What to send for the edited rows: only variants with a changed field, and
// only the fields that changed, so a value someone else saved meanwhile is
// kept. Invalid inputs are reported per variant and field instead.
export const buildVariantPricingChanges = (
  variants: AdminVariantPricingVariant[],
  rows: VariantPricingFormRow[]
): {
  changes: AdminUpdateVariantPricingItem[]
  errors: VariantPricingFormErrors
} => {
  const saved = new Map(variants.map((variant) => [variant.variant_id, variant]))
  const changes: AdminUpdateVariantPricingItem[] = []
  const errors: VariantPricingFormErrors = {}

  for (const row of rows) {
    const variant = saved.get(row.variant_id)

    if (!variant) {
      continue
    }

    const change: AdminUpdateVariantPricingItem = { variant_id: row.variant_id }

    for (const field of FIELDS) {
      const amount = parseAmountInput(row[field])

      if (amount === undefined) {
        errors[row.variant_id] = {
          ...errors[row.variant_id],
          [field]: AMOUNT_ERROR,
        }
        continue
      }

      if (amount !== variant[field]) {
        change[field] = amount
      }
    }

    if (Object.keys(change).length > 1) {
      changes.push(change)
    }
  }

  return { changes, errors }
}

// Why the storefront won't show a compare-at price the admin set, or null
// when it will (or when none is set). Same rule as `/store` (T21): it must be
// strictly higher than the variant's price.
export const compareAtHiddenReason = (
  compareAtAmount: number | null | undefined,
  price: number | null | undefined
): string | null => {
  if (compareAtAmount == null) {
    return null
  }

  if (price == null) {
    return "Not shown in the storefront: the variant has no price to compare with"
  }

  return storefrontCompareAtAmount(compareAtAmount, price) == null
    ? "Not shown in the storefront: it must be higher than the price"
    : null
}

// An amount as the admin sees it, in the store's currency. Amounts are
// stored as-is (49.99 = 49.99), so they are never divided.
export const formatAmount = (
  amount: number | null | undefined,
  currencyCode: string | null | undefined
): string => {
  if (amount == null) {
    return "-"
  }

  if (!currencyCode) {
    return String(amount)
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
      // Never round what was saved: 49.999 shows as $49.999, not $50.00.
      maximumFractionDigits: 20,
    }).format(amount)
  } catch {
    // An unknown currency code: show the amount with the code as sent.
    return `${amount} ${currencyCode.toUpperCase()}`
  }
}
