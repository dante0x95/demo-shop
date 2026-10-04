import {
  findBasePriceAmount,
  findDefaultCurrencyCode,
  findVariantsNotInProduct,
  storefrontCompareAtAmount,
  variantPricingChanges,
} from "../variant-pricing"

describe("findDefaultCurrencyCode", () => {
  it("returns the currency marked as default", () => {
    expect(
      findDefaultCurrencyCode([
        { currency_code: "usd", is_default: false },
        { currency_code: "eur", is_default: true },
      ])
    ).toBe("eur")
  })

  it("lowercases the code", () => {
    expect(
      findDefaultCurrencyCode([{ currency_code: "EUR", is_default: true }])
    ).toBe("eur")
  })

  it("is null when no currency is the default", () => {
    expect(
      findDefaultCurrencyCode([{ currency_code: "usd", is_default: false }])
    ).toBeNull()
    expect(findDefaultCurrencyCode([])).toBeNull()
    expect(findDefaultCurrencyCode(undefined)).toBeNull()
  })
})

describe("findBasePriceAmount", () => {
  const base = { amount: 20, currency_code: "eur" }

  it("returns the variant's own price in the currency", () => {
    expect(
      findBasePriceAmount([{ amount: 25, currency_code: "usd" }, base], "eur")
    ).toBe(20)
  })

  it("matches the currency case-insensitively", () => {
    expect(findBasePriceAmount([base], "EUR")).toBe(20)
  })

  it("ignores price list, rule-based and quantity-tier prices", () => {
    expect(
      findBasePriceAmount(
        [
          { amount: 15, currency_code: "eur", price_list_id: "plist_1" },
          { amount: 16, currency_code: "eur", rules_count: 1 },
          { amount: 17, currency_code: "eur", min_quantity: 10 },
          { amount: 18, currency_code: "eur", max_quantity: 5 },
          { ...base, price_list_id: null, rules_count: 0 },
        ],
        "eur"
      )
    ).toBe(20)
  })

  it("is null when the variant has no own price in the currency", () => {
    expect(
      findBasePriceAmount(
        [
          { amount: 25, currency_code: "usd" },
          { amount: 15, currency_code: "eur", price_list_id: "plist_1" },
        ],
        "eur"
      )
    ).toBeNull()
    expect(findBasePriceAmount([], "eur")).toBeNull()
    expect(findBasePriceAmount(undefined, "eur")).toBeNull()
  })

  it("is null when there is no currency to look in", () => {
    expect(findBasePriceAmount([base], null)).toBeNull()
  })

  it("keeps a price of zero", () => {
    expect(findBasePriceAmount([{ amount: 0, currency_code: "eur" }], "eur")).toBe(0)
  })
})

describe("storefrontCompareAtAmount", () => {
  it("shows a compare-at price strictly higher than the price", () => {
    expect(storefrontCompareAtAmount(30, 20)).toBe(30)
    expect(storefrontCompareAtAmount(20.01, 20)).toBe(20.01)
  })

  it("hides a compare-at price equal to the price", () => {
    expect(storefrontCompareAtAmount(20, 20)).toBeNull()
  })

  it("hides a compare-at price lower than the price", () => {
    expect(storefrontCompareAtAmount(10, 20)).toBeNull()
    expect(storefrontCompareAtAmount(0, 20)).toBeNull()
  })

  it("is null when no compare-at price is set", () => {
    expect(storefrontCompareAtAmount(null, 20)).toBeNull()
    expect(storefrontCompareAtAmount(undefined, 20)).toBeNull()
  })

  it("is null when the variant has no price to compare with", () => {
    expect(storefrontCompareAtAmount(30, null)).toBeNull()
    expect(storefrontCompareAtAmount(30, undefined)).toBeNull()
  })

  it("shows a compare-at price above a free variant", () => {
    expect(storefrontCompareAtAmount(5, 0)).toBe(5)
  })
})

describe("variantPricingChanges", () => {
  it("keeps only the fields that were sent", () => {
    expect(variantPricingChanges({ compare_at_amount: 30 })).toEqual({
      compare_at_amount: 30,
    })
    expect(variantPricingChanges({ cost_amount: 4 })).toEqual({
      cost_amount: 4,
    })
  })

  it("keeps null, which clears a value", () => {
    expect(
      variantPricingChanges({ compare_at_amount: null, cost_amount: null })
    ).toEqual({ compare_at_amount: null, cost_amount: null })
  })

  it("keeps zero", () => {
    expect(variantPricingChanges({ compare_at_amount: 0, cost_amount: 0 })).toEqual(
      { compare_at_amount: 0, cost_amount: 0 }
    )
  })

  it("is empty when nothing was sent", () => {
    expect(variantPricingChanges({})).toEqual({})
  })
})

describe("findVariantsNotInProduct", () => {
  it("is empty when every requested variant belongs to the product", () => {
    expect(findVariantsNotInProduct(["v1", "v2"], ["v2", "v1"])).toEqual([])
  })

  it("lists the requested variants of other products, in request order", () => {
    expect(
      findVariantsNotInProduct(["v1"], ["other_b", "v1", "other_a"])
    ).toEqual(["other_b", "other_a"])
  })

  it("lists a repeated unknown variant once", () => {
    expect(findVariantsNotInProduct(["v1"], ["x", "x"])).toEqual(["x"])
  })

  it("rejects every variant of a product without variants", () => {
    expect(findVariantsNotInProduct([], ["v1"])).toEqual(["v1"])
  })
})
