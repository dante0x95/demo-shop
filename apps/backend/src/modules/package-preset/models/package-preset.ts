import { model } from "@medusajs/framework/utils"

export const DIMENSION_UNITS = ["mm", "cm", "in"] as const

export type DimensionUnit = (typeof DIMENSION_UNITS)[number]

export const WEIGHT_UNITS = ["g", "kg", "oz", "lb"] as const

export type WeightUnit = (typeof WEIGHT_UNITS)[number]

const PackagePreset = model
  .define("package_preset", {
    id: model.id({ prefix: "pkgpre" }).primaryKey(),
    name: model.text(),
    // Same column type as the product and variant dimensions in core.
    length: model.float(),
    width: model.float(),
    height: model.float(),
    dimension_unit: model.enum([...DIMENSION_UNITS]),
    // Weight of the empty package.
    weight: model.float(),
    weight_unit: model.enum([...WEIGHT_UNITS]),
    is_default: model.boolean().default(false),
  })
  .indexes([
    {
      // At most one non-deleted default, also under concurrent requests.
      on: ["is_default"],
      unique: true,
      where: { is_default: true },
    },
  ])

export default PackagePreset
