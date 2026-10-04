import { AdminUpdateVariantPricing } from "../validators"

const parse = (body: unknown) => AdminUpdateVariantPricing.safeParse(body)

describe("AdminUpdateVariantPricing", () => {
  it("accepts both amounts for a variant", () => {
    const result = parse({
      variants: [{ variant_id: "v1", compare_at_amount: 49.99, cost_amount: 12.5 }],
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      variants: [{ variant_id: "v1", compare_at_amount: 49.99, cost_amount: 12.5 }],
    })
  })

  it("accepts a single amount, leaving the other out", () => {
    expect(parse({ variants: [{ variant_id: "v1", cost_amount: 3 }] }).success).toBe(
      true
    )
    expect(
      parse({ variants: [{ variant_id: "v1", compare_at_amount: 3 }] }).success
    ).toBe(true)
  })

  it("accepts null to clear an amount, and zero", () => {
    expect(
      parse({
        variants: [{ variant_id: "v1", compare_at_amount: null, cost_amount: 0 }],
      }).success
    ).toBe(true)
  })

  it("accepts several variants", () => {
    expect(
      parse({
        variants: [
          { variant_id: "v1", cost_amount: 1 },
          { variant_id: "v2", cost_amount: 2 },
        ],
      }).success
    ).toBe(true)
  })

  it.each([
    ["an empty body", {}],
    ["no variants", { variants: [] }],
    ["a variant without amounts", { variants: [{ variant_id: "v1" }] }],
    ["a missing variant id", { variants: [{ cost_amount: 1 }] }],
    ["an empty variant id", { variants: [{ variant_id: "", cost_amount: 1 }] }],
    [
      "a negative compare-at price",
      { variants: [{ variant_id: "v1", compare_at_amount: -1 }] },
    ],
    ["a negative cost", { variants: [{ variant_id: "v1", cost_amount: -0.01 }] }],
    [
      "an amount sent as a string",
      { variants: [{ variant_id: "v1", cost_amount: "10" }] },
    ],
    [
      "an infinite amount",
      { variants: [{ variant_id: "v1", cost_amount: Infinity }] },
    ],
    [
      "the same variant twice",
      {
        variants: [
          { variant_id: "v1", cost_amount: 1 },
          { variant_id: "v1", compare_at_amount: 2 },
        ],
      },
    ],
    [
      "an unknown field on a variant",
      { variants: [{ variant_id: "v1", cost_amount: 1, price: 5 }] },
    ],
    [
      "an unknown top-level field",
      { variants: [{ variant_id: "v1", cost_amount: 1 }], currency_code: "usd" },
    ],
  ])("rejects %s", (_, body) => {
    expect(parse(body).success).toBe(false)
  })
})
