import {
  AMOUNT_ERROR,
  buildVariantPricingChanges,
  compareAtHiddenReason,
  formatAmount,
  parseAmountInput,
  toVariantPricingFormRows,
} from "../utils"

const variant = (
  id: string,
  values: {
    price?: number | null
    compare_at_amount?: number | null
    cost_amount?: number | null
  } = {}
) => ({
  variant_id: id,
  title: `Variant ${id}`,
  sku: null,
  price: values.price ?? 50,
  compare_at_amount: values.compare_at_amount ?? null,
  cost_amount: values.cost_amount ?? null,
})

const row = (id: string, compareAt: string, cost: string) => ({
  variant_id: id,
  compare_at_amount: compareAt,
  cost_amount: cost,
})

describe("parseAmountInput", () => {
  it("reads decimal amounts as typed", () => {
    expect(parseAmountInput("49.99")).toBe(49.99)
    expect(parseAmountInput("120")).toBe(120)
    expect(parseAmountInput(".5")).toBe(0.5)
    expect(parseAmountInput("10.")).toBe(10)
  })

  it("accepts zero, the lowest amount the API takes", () => {
    expect(parseAmountInput("0")).toBe(0)
  })

  it("ignores surrounding spaces", () => {
    expect(parseAmountInput("  12.5 ")).toBe(12.5)
  })

  it("reads an empty or blank field as null, which clears the value", () => {
    expect(parseAmountInput("")).toBeNull()
    expect(parseAmountInput("   ")).toBeNull()
  })

  it.each(["-1", "abc", "1,5", "1e3", "1.2.3", "$10", "+5", "."])(
    "rejects %p as an amount",
    (input) => {
      expect(parseAmountInput(input)).toBeUndefined()
    }
  )
})

describe("toVariantPricingFormRows", () => {
  it("shows saved amounts as text and unset ones as empty fields", () => {
    expect(
      toVariantPricingFormRows([
        variant("a", { compare_at_amount: 79.9, cost_amount: 0 }),
        variant("b"),
      ])
    ).toEqual([
      row("a", "79.9", "0"),
      row("b", "", ""),
    ])
  })
})

describe("buildVariantPricingChanges", () => {
  it("sends nothing when no field changed", () => {
    const saved = [variant("a", { compare_at_amount: 80, cost_amount: 20 })]

    expect(
      buildVariantPricingChanges(saved, [row("a", "80", "20")])
    ).toEqual({ changes: [], errors: {} })
  })

  it("treats the same amount written differently as unchanged", () => {
    const saved = [variant("a", { compare_at_amount: 80, cost_amount: 20.5 })]

    expect(
      buildVariantPricingChanges(saved, [row("a", "80.00", " 20.50 ")])
    ).toEqual({ changes: [], errors: {} })
  })

  it("sends only the changed field of a variant", () => {
    const saved = [variant("a", { compare_at_amount: 80, cost_amount: 20 })]

    expect(buildVariantPricingChanges(saved, [row("a", "95", "20")])).toEqual({
      changes: [{ variant_id: "a", compare_at_amount: 95 }],
      errors: {},
    })
  })

  it("sends only the variants that changed", () => {
    const saved = [variant("a"), variant("b"), variant("c", { cost_amount: 5 })]

    expect(
      buildVariantPricingChanges(saved, [
        row("a", "", ""),
        row("b", "60", "30"),
        row("c", "", "5"),
      ])
    ).toEqual({
      changes: [{ variant_id: "b", compare_at_amount: 60, cost_amount: 30 }],
      errors: {},
    })
  })

  it("sends null for an emptied field so the value is cleared", () => {
    const saved = [variant("a", { compare_at_amount: 80, cost_amount: 20 })]

    expect(buildVariantPricingChanges(saved, [row("a", "", " ")])).toEqual({
      changes: [{ variant_id: "a", compare_at_amount: null, cost_amount: null }],
      errors: {},
    })
  })

  it("sends a compare-at lower than the price: any value is saved", () => {
    const saved = [variant("a", { price: 50 })]

    expect(buildVariantPricingChanges(saved, [row("a", "10", "")])).toEqual({
      changes: [{ variant_id: "a", compare_at_amount: 10 }],
      errors: {},
    })
  })

  it("reports each invalid field per variant and sends nothing for it", () => {
    const saved = [variant("a"), variant("b")]

    expect(
      buildVariantPricingChanges(saved, [
        row("a", "-5", "abc"),
        row("b", "70", "1,5"),
      ])
    ).toEqual({
      changes: [{ variant_id: "b", compare_at_amount: 70 }],
      errors: {
        a: { compare_at_amount: AMOUNT_ERROR, cost_amount: AMOUNT_ERROR },
        b: { cost_amount: AMOUNT_ERROR },
      },
    })
  })

  it("skips rows of variants it was not given", () => {
    expect(
      buildVariantPricingChanges([variant("a")], [row("gone", "10", "5")])
    ).toEqual({ changes: [], errors: {} })
  })
})

describe("compareAtHiddenReason", () => {
  it("says nothing when no compare-at price is set", () => {
    expect(compareAtHiddenReason(null, 50)).toBeNull()
    expect(compareAtHiddenReason(undefined, null)).toBeNull()
  })

  it("says nothing when the compare-at is higher than the price", () => {
    expect(compareAtHiddenReason(50.01, 50)).toBeNull()
  })

  it("explains a compare-at equal to the price is not shown", () => {
    expect(compareAtHiddenReason(50, 50)).toBe(
      "Not shown in the storefront: it must be higher than the price"
    )
  })

  it("explains a compare-at lower than the price is not shown", () => {
    expect(compareAtHiddenReason(0, 50)).toBe(
      "Not shown in the storefront: it must be higher than the price"
    )
  })

  it("explains a variant without a price shows no compare-at", () => {
    expect(compareAtHiddenReason(80, null)).toBe(
      "Not shown in the storefront: the variant has no price to compare with"
    )
  })
})

describe("formatAmount", () => {
  it("shows the amount as stored, in the store's currency, never divided", () => {
    expect(formatAmount(49.99, "usd")).toBe("$49.99")
    expect(formatAmount(1200, "usd")).toBe("$1,200.00")
  })

  it("does not round extra decimals away", () => {
    expect(formatAmount(49.999, "usd")).toBe("$49.999")
  })

  it("shows zero as an amount, not as missing", () => {
    expect(formatAmount(0, "eur")).toBe("€0.00")
  })

  it("shows a dash when there is no amount", () => {
    expect(formatAmount(null, "usd")).toBe("-")
    expect(formatAmount(undefined, "usd")).toBe("-")
  })

  it("shows the bare amount when the store has no default currency", () => {
    expect(formatAmount(12.5, null)).toBe("12.5")
  })

  it("falls back to the amount and code for a code Intl rejects", () => {
    expect(formatAmount(10, "nope")).toBe("10 NOPE")
  })
})
