// Type-only imports from the SDK client: this file stays free of the SDK so
// unit tests can load it.
import type {
  AdminPackagePreset,
  AdminProductPackagePreset,
} from "../../lib/package-presets"
import {
  formatPackageDimensions,
  formatPackageWeight,
} from "../../lib/package-preset-display"

// The picker's value for "no preset of its own": Select values can't be empty
// or null, and preset ids never contain a colon.
export const STORE_DEFAULT_OPTION = "store-default:"

export const toPackagePresetOption = (presetId: string | null | undefined) =>
  presetId ?? STORE_DEFAULT_OPTION

export const fromPackagePresetOption = (option: string): string | null =>
  option === STORE_DEFAULT_OPTION ? null : option

export type ProductPackageSource = "product" | "store_default" | "none"

// Where the package the product ships in comes from: its own preset, the
// store's default (T23), or nowhere when the shop has no default yet.
export const productPackageSource = (
  view: Pick<AdminProductPackagePreset, "package_preset" | "resolved">
): ProductPackageSource => {
  if (view.package_preset) {
    return "product"
  }

  return view.resolved ? "store_default" : "none"
}

// A preset in the picker: its name with its size and empty weight, since
// two presets can look alike by name alone.
export const packagePresetOptionLabel = (preset: AdminPackagePreset) =>
  `${preset.name} (${formatPackageDimensions(preset)}, ${formatPackageWeight(preset)})`

// The "Store default" option names the preset it stands for, so the admin
// knows what the product ships in without a preset of its own.
export const storeDefaultOptionLabel = (
  presets: Pick<AdminPackagePreset, "name" | "is_default">[]
) => {
  const storeDefault = presets.find((preset) => preset.is_default)

  return storeDefault
    ? `Store default (${storeDefault.name})`
    : "Store default (none set)"
}
