// The units a package preset can be measured in. Plain data with no Node APIs,
// so the admin UI can import it too.
export const DIMENSION_UNITS = ["mm", "cm", "in"] as const

export type DimensionUnit = (typeof DIMENSION_UNITS)[number]

export const WEIGHT_UNITS = ["g", "kg", "oz", "lb"] as const

export type WeightUnit = (typeof WEIGHT_UNITS)[number]
