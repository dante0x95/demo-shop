import type { AdminPackagePreset } from "../../../lib/package-presets"
import {
  fromPackagePresetOption,
  packagePresetOptionLabel,
  productPackageSource,
  STORE_DEFAULT_OPTION,
  storeDefaultOptionLabel,
  toPackagePresetOption,
} from "../utils"

const preset = (
  id: string,
  values: Partial<AdminPackagePreset> = {}
): AdminPackagePreset => ({
  id,
  name: `Box ${id}`,
  length: 30,
  width: 20,
  height: 10.5,
  dimension_unit: "cm",
  weight: 0.25,
  weight_unit: "kg",
  is_default: false,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  ...values,
})

describe("package preset picker options", () => {
  it("uses the preset id as the option for a product's own preset", () => {
    expect(toPackagePresetOption("pkgpre_1")).toBe("pkgpre_1")
    expect(fromPackagePresetOption("pkgpre_1")).toBe("pkgpre_1")
  })

  it("maps no preset to the store default option and back to null", () => {
    expect(toPackagePresetOption(null)).toBe(STORE_DEFAULT_OPTION)
    expect(toPackagePresetOption(undefined)).toBe(STORE_DEFAULT_OPTION)
    expect(fromPackagePresetOption(STORE_DEFAULT_OPTION)).toBeNull()
  })

  it("never uses an empty value, which the picker can't hold", () => {
    expect(STORE_DEFAULT_OPTION).not.toBe("")
  })
})

describe("productPackageSource", () => {
  it("is the product's own preset when it has one", () => {
    const own = preset("own")

    expect(
      productPackageSource({ package_preset: own, resolved: own })
    ).toBe("product")
  })

  it("is the product's own preset even when that preset is the default", () => {
    const own = preset("own", { is_default: true })

    expect(
      productPackageSource({ package_preset: own, resolved: own })
    ).toBe("product")
  })

  it("is the store default when the product has no preset", () => {
    expect(
      productPackageSource({
        package_preset: null,
        resolved: preset("default", { is_default: true }),
      })
    ).toBe("store_default")
  })

  it("is none when neither the product nor the store has a preset", () => {
    expect(
      productPackageSource({ package_preset: null, resolved: null })
    ).toBe("none")
  })
})

describe("packagePresetOptionLabel", () => {
  it("shows the name with the size and empty weight", () => {
    expect(packagePresetOptionLabel(preset("m", { name: "Medium box" }))).toBe(
      "Medium box (30 × 20 × 10.5 cm, 0.25 kg)"
    )
  })
})

describe("storeDefaultOptionLabel", () => {
  it("names the store's default preset", () => {
    expect(
      storeDefaultOptionLabel([
        preset("a", { name: "Small" }),
        preset("b", { name: "Large", is_default: true }),
      ])
    ).toBe("Store default (Large)")
  })

  it("says none is set when the store has no default", () => {
    expect(storeDefaultOptionLabel([preset("a")])).toBe(
      "Store default (none set)"
    )
    expect(storeDefaultOptionLabel([])).toBe("Store default (none set)")
  })
})
