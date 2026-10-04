import { AdminSetProductPackagePreset } from "../validators"

describe("AdminSetProductPackagePreset", () => {
  it("accepts a preset id and trims it", () => {
    expect(
      AdminSetProductPackagePreset.parse({ package_preset_id: " pkgpre_1 " })
    ).toEqual({ package_preset_id: "pkgpre_1" })
  })

  it("accepts null to remove the product's preset", () => {
    expect(
      AdminSetProductPackagePreset.parse({ package_preset_id: null })
    ).toEqual({ package_preset_id: null })
  })

  it("rejects a body without package_preset_id", () => {
    expect(AdminSetProductPackagePreset.safeParse({}).success).toBe(false)
  })

  it("rejects an empty or whitespace-only id", () => {
    expect(
      AdminSetProductPackagePreset.safeParse({ package_preset_id: "" }).success
    ).toBe(false)
    expect(
      AdminSetProductPackagePreset.safeParse({ package_preset_id: "   " })
        .success
    ).toBe(false)
  })

  it("rejects a non-string id", () => {
    expect(
      AdminSetProductPackagePreset.safeParse({ package_preset_id: 42 }).success
    ).toBe(false)
  })

  it("rejects unknown fields", () => {
    expect(
      AdminSetProductPackagePreset.safeParse({
        package_preset_id: "pkgpre_1",
        variant_id: "variant_1",
      }).success
    ).toBe(false)
  })
})
