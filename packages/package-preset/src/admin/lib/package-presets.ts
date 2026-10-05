import {
  DIMENSION_UNITS,
  DimensionUnit,
  WEIGHT_UNITS,
  WeightUnit,
} from "../../modules/package-preset/utils/units"
import { collectPages } from "./collect-pages"
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
  // Every preset, for the product's package picker.
  options: () => ["package_presets", "options"] as const,
}

export { formatPackageDimensions, formatPackageWeight } from "./package-preset-display"

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

// Mirrors `GET /admin/products/:id/package-preset` (T23).
export type AdminProductPackagePreset = {
  product_id: string
  // The preset picked for the product; null = none picked.
  package_preset: AdminPackagePreset | null
  // The preset the product ships in when shipped alone: its own, else the
  // store's default, else null (the shop has no default preset).
  resolved: AdminPackagePreset | null
}

export type AdminProductPackagePresetResponse = {
  product_package_preset: AdminProductPackagePreset
}

// Nested under the dashboard's product detail key (["products", "detail",
// id, ...]), like the product's other widgets.
export const productPackagePresetQueryKeys = {
  detail: (productId: string) =>
    [
      "products",
      "detail",
      productId,
      { package_preset_widget: true },
    ] as const,
}

export const retrieveProductPackagePreset = (productId: string) =>
  sdk.client.fetch<AdminProductPackagePresetResponse>(
    `/admin/products/${productId}/package-preset`
  )

// A preset id picks it for the product; null removes the product's preset so
// the store's default applies again.
export const setProductPackagePreset = (
  productId: string,
  packagePresetId: string | null
) =>
  sdk.client.fetch<AdminProductPackagePresetResponse>(
    `/admin/products/${productId}/package-preset`,
    { method: "POST", body: { package_preset_id: packagePresetId } }
  )

const ALL_PRESETS_PAGE_SIZE = 100

// Every preset, by name, for the product's package picker. Shops keep a
// handful, but the list is paged so none is ever left out.
export const listAllPackagePresets = () =>
  collectPages<AdminPackagePreset>(async (offset, limit) => {
    const page = await listPackagePresets({ limit, offset, order: "name" })

    return { items: page.package_presets, count: page.count }
  }, ALL_PRESETS_PAGE_SIZE)
