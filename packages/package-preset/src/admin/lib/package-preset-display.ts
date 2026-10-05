// How a package preset reads in the admin. Free of the SDK so unit tests can
// load it.
import type { DimensionUnit, WeightUnit } from "../../modules/package-preset/utils/units"

type PresetDimensions = {
  length: number
  width: number
  height: number
  dimension_unit: DimensionUnit
}

type PresetWeight = {
  weight: number
  weight_unit: WeightUnit
}

export const formatPackageDimensions = (preset: PresetDimensions) =>
  `${preset.length} × ${preset.width} × ${preset.height} ${preset.dimension_unit}`

export const formatPackageWeight = (preset: PresetWeight) =>
  `${preset.weight} ${preset.weight_unit}`
