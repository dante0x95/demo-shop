import { z } from "@medusajs/framework/zod"
import {
  createFindParams,
  createSelectParams,
} from "@medusajs/medusa/api/utils/validators"
import {
  DIMENSION_UNITS,
  WEIGHT_UNITS,
} from "../../../modules/package-preset/models/package-preset"

export const AdminGetPackagePresetParams = createSelectParams()

export type AdminGetPackagePresetParamsType = z.infer<
  typeof AdminGetPackagePresetParams
>

// Query strings carry booleans as text; anything but "true"/"false" is a 400.
const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true")

// `with_deleted` is left out: a deleted preset can no longer be used.
export const AdminGetPackagePresetsParams = z.strictObject({
  ...createFindParams({ limit: 20, offset: 0, order: "-created_at" }).omit({
    with_deleted: true,
  }).shape,
  is_default: booleanQuery.optional(),
})

export type AdminGetPackagePresetsParamsType = z.infer<
  typeof AdminGetPackagePresetsParams
>

const dimension = z.number().positive()

export const AdminCreatePackagePreset = z.strictObject({
  name: z.string().trim().min(1).max(255),
  length: dimension,
  width: dimension,
  height: dimension,
  dimension_unit: z.enum(DIMENSION_UNITS),
  // Weight of the empty package; 0 is allowed for negligible packaging.
  weight: z.number().nonnegative(),
  weight_unit: z.enum(WEIGHT_UNITS),
  is_default: z.boolean().optional(),
})

export type AdminCreatePackagePresetType = z.infer<
  typeof AdminCreatePackagePreset
>
