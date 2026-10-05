import { planProductPackagePresetLinks } from "../product-package-preset-links"

const link = (productId: string, packagePresetId: string) => ({
  product: { product_id: productId },
  packagePreset: { package_preset_id: packagePresetId },
})

describe("planProductPackagePresetLinks", () => {
  it("links the preset to a product that has none", () => {
    expect(
      planProductPackagePresetLinks({
        productId: "prod_1",
        currentPackagePresetId: null,
        nextPackagePresetId: "pkgpre_small",
      })
    ).toEqual({ dismiss: [], create: [link("prod_1", "pkgpre_small")] })
  })

  it("replaces the current preset: unlinks it and links the new one", () => {
    expect(
      planProductPackagePresetLinks({
        productId: "prod_1",
        currentPackagePresetId: "pkgpre_small",
        nextPackagePresetId: "pkgpre_large",
      })
    ).toEqual({
      dismiss: [link("prod_1", "pkgpre_small")],
      create: [link("prod_1", "pkgpre_large")],
    })
  })

  it("changes nothing when the current preset is set again", () => {
    expect(
      planProductPackagePresetLinks({
        productId: "prod_1",
        currentPackagePresetId: "pkgpre_small",
        nextPackagePresetId: "pkgpre_small",
      })
    ).toEqual({ dismiss: [], create: [] })
  })

  it("only unlinks when the preset is removed (null)", () => {
    expect(
      planProductPackagePresetLinks({
        productId: "prod_1",
        currentPackagePresetId: "pkgpre_small",
        nextPackagePresetId: null,
      })
    ).toEqual({ dismiss: [link("prod_1", "pkgpre_small")], create: [] })
  })

  it("changes nothing when removing the preset of a product without one", () => {
    expect(
      planProductPackagePresetLinks({
        productId: "prod_1",
        currentPackagePresetId: null,
        nextPackagePresetId: null,
      })
    ).toEqual({ dismiss: [], create: [] })
  })
})
