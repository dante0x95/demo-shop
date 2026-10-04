import { collectResponseVariants } from "../helpers"

describe("collectResponseVariants", () => {
  it("collects the variants of every product in a list", () => {
    const v1 = { id: "v1" }
    const v2 = { id: "v2" }
    const v3 = { id: "v3" }

    const variants = collectResponseVariants({
      products: [{ variants: [v1, v2] }, { variants: [v3] }],
    })

    expect(variants).toEqual([v1, v2, v3])
    // The same objects, so values set on them reach the response body.
    expect(variants[0]).toBe(v1)
  })

  it("collects a single product's variants", () => {
    const v1 = { id: "v1" }

    expect(collectResponseVariants({ product: { variants: [v1] } })).toEqual([
      v1,
    ])
  })

  it("collects the variants of the product-variants routes", () => {
    const v1 = { id: "v1" }
    const v2 = { id: "v2" }

    expect(collectResponseVariants({ variants: [v1] })).toEqual([v1])
    expect(collectResponseVariants({ variant: v2 })).toEqual([v2])
  })

  it("is empty when products were asked for without variants", () => {
    expect(
      collectResponseVariants({ products: [{ id: "p1" }, { id: "p2" }] })
    ).toEqual([])
  })

  it("skips null and non-object entries", () => {
    const v1 = { id: "v1" }

    expect(
      collectResponseVariants({
        products: [{ variants: [null, v1, "v2"] }, null as any],
      })
    ).toEqual([v1])
  })

  it("is empty for bodies without products or variants", () => {
    expect(collectResponseVariants({})).toEqual([])
    expect(collectResponseVariants(undefined as any)).toEqual([])
  })
})
