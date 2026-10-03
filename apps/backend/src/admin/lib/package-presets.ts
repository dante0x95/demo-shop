import {
  DIMENSION_UNITS,
  DimensionUnit,
  WEIGHT_UNITS,
  WeightUnit,
} from "../../modules/package-preset/utils/units"
import { sdk } from "./sdk"

export { DIMENSION_UNITS, WEIGHT_UNITS }
export type { DimensionUnit, WeightUnit }

export type AdminPackagePreset = {
  id: string
  name: string
  length: number
  width: number
  height: number
  dimension_unit: DimensionUnit
  weight: number
  weight_unit: WeightUnit
  is_default: boolean
  created_at: string
  updated_at: string
}

export type AdminPackagePresetListResponse = {
  package_presets: AdminPackagePreset[]
  count: number
  offset: number
  limit: number
}

export type AdminPackagePresetResponse = {
  package_preset: AdminPackagePreset
}

export type AdminPackagePresetListParams = {
  limit: number
  offset: number
  order?: string
  is_default?: boolean
}

// Fields the form leaves empty are omitted, so the API's own 400 explains
// what is missing.
export type AdminCreatePackagePresetPayload = {
  name: string
  length?: number
  width?: number
  height?: number
  dimension_unit?: DimensionUnit
  weight?: number
  weight_unit?: WeightUnit
  is_default?: boolean
}

export const packagePresetQueryKeys = {
  all: ["package_presets"] as const,
  list: (params: AdminPackagePresetListParams) =>
    ["package_presets", "list", params] as const,
}

export const formatPackageDimensions = (preset: AdminPackagePreset) =>
  `${preset.length} × ${preset.width} × ${preset.height} ${preset.dimension_unit}`

export const formatPackageWeight = (preset: AdminPackagePreset) =>
  `${preset.weight} ${preset.weight_unit}`

export const listPackagePresets = (params: AdminPackagePresetListParams) =>
  sdk.client.fetch<AdminPackagePresetListResponse>("/admin/package-presets", {
    query: params,
  })

export const createPackagePreset = (body: AdminCreatePackagePresetPayload) =>
  sdk.client.fetch<AdminPackagePresetResponse>("/admin/package-presets", {
    method: "POST",
    body,
  })

export const setDefaultPackagePreset = (id: string) =>
  sdk.client.fetch<AdminPackagePresetResponse>(
    `/admin/package-presets/${id}/set-default`,
    { method: "POST", body: {} }
  )

export const deletePackagePreset = (id: string) =>
  sdk.client.fetch<{ id: string; object: "package_preset"; deleted: boolean }>(
    `/admin/package-presets/${id}`,
    { method: "DELETE" }
  )
