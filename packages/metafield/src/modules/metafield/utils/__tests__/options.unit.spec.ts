import { DEFAULT_OWNER_TYPES, resolveMetafieldModuleOptions } from "../options"

describe("resolveMetafieldModuleOptions", () => {
  it("applies the defaults", () => {
    expect(resolveMetafieldModuleOptions()).toEqual({
      owner_types: DEFAULT_OWNER_TYPES,
    })
  })

  it("keeps valid overrides, trimmed and without duplicates", () => {
    expect(
      resolveMetafieldModuleOptions({
        owner_types: ["product", " product_variant ", "product_variant"],
      })
    ).toEqual({ owner_types: ["product", "product_variant"] })
  })

  it("rejects an empty owner type list", () => {
    expect(() => resolveMetafieldModuleOptions({ owner_types: [] })).toThrow(
      "owner_types must be a non-empty list"
    )
  })

  it("rejects a blank owner type", () => {
    expect(() =>
      resolveMetafieldModuleOptions({ owner_types: ["product", "  "] })
    ).toThrow("owner_types must be a non-empty list")
  })
})
