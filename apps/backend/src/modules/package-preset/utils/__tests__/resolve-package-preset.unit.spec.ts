import { resolvePackagePreset } from "../resolve-package-preset"

const small = { id: "pkgpre_small", is_default: false }
const storeDefault = { id: "pkgpre_default", is_default: true }

describe("resolvePackagePreset", () => {
  it("uses the product's own preset over the store default", () => {
    expect(resolvePackagePreset(small, storeDefault)).toBe(small)
  })

  it("falls back to the store default when the product has none", () => {
    expect(resolvePackagePreset(null, storeDefault)).toBe(storeDefault)
    expect(resolvePackagePreset(undefined, storeDefault)).toBe(storeDefault)
  })

  it("uses the product's preset when the shop has no default", () => {
    expect(resolvePackagePreset(small, null)).toBe(small)
  })

  it("returns null when neither the product nor the shop has a preset", () => {
    expect(resolvePackagePreset(null, null)).toBeNull()
    expect(resolvePackagePreset(undefined, undefined)).toBeNull()
  })
})
