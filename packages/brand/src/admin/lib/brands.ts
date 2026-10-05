import { sdk } from "./sdk"

export type AdminBrand = {
  id: string
  name: string
  handle: string
  description: string | null
  logo_url: string | null
  banner_url: string | null
  is_active: boolean
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type AdminBrandListResponse = {
  brands: AdminBrand[]
  count: number
  offset: number
  limit: number
}

export type AdminBrandResponse = {
  brand: AdminBrand
}

export type AdminBrandProduct = {
  id: string
  title: string
  handle: string
  status: string
  thumbnail: string | null
}

export type AdminBrandDetail = AdminBrand & {
  products: AdminBrandProduct[]
}

export type AdminBrandDetailResponse = {
  brand: AdminBrandDetail
}

export type AdminCreateBrandPayload = {
  name: string
  handle?: string
  description?: string
  logo_url?: string
  banner_url?: string
  is_active?: boolean
}

// null clears an optional field.
export type AdminUpdateBrandPayload = {
  name?: string
  handle?: string
  description?: string | null
  logo_url?: string | null
  banner_url?: string | null
  is_active?: boolean
}

export type AdminBrandListParams = {
  limit: number
  offset: number
  order?: string
}

export const brandQueryKeys = {
  all: ["brands"] as const,
  list: (params: AdminBrandListParams) => ["brands", "list", params] as const,
  detail: (id: string) => ["brands", "detail", id] as const,
}

export const listBrands = (params: AdminBrandListParams) =>
  sdk.client.fetch<AdminBrandListResponse>("/admin/brands", {
    query: params,
  })

export const createBrand = (payload: AdminCreateBrandPayload) =>
  sdk.client.fetch<AdminBrandResponse>("/admin/brands", {
    method: "POST",
    body: payload,
  })

export const retrieveBrand = (id: string) =>
  sdk.client.fetch<AdminBrandDetailResponse>(`/admin/brands/${id}`)

export const updateBrand = (id: string, payload: AdminUpdateBrandPayload) =>
  sdk.client.fetch<AdminBrandDetailResponse>(`/admin/brands/${id}`, {
    method: "POST",
    body: payload,
  })

export const deleteBrand = (id: string) =>
  sdk.client.fetch<{ id: string; object: "brand"; deleted: boolean }>(
    `/admin/brands/${id}`,
    { method: "DELETE" }
  )
