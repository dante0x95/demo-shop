import { sdk } from "./sdk"

// Mirrors `GET /admin/products/:id/seo` (T22).
export type AdminProductSeo = {
  product_id: string
  // What the admin set; null = not set (the storefront uses the fallback).
  title: string | null
  description: string | null
  // What the storefront renders, fallbacks applied.
  resolved: {
    title: string
    description: string | null
  }
}

// A field left out keeps its stored value; null (or an empty value) clears it.
export type AdminUpdateProductSeoPayload = {
  title?: string | null
  description?: string | null
}

export type AdminProductSeoResponse = {
  product_seo: AdminProductSeo
}

// Nested under the dashboard's product detail key: renaming the product or
// changing its description on the product page also refreshes the fallbacks.
export const productSeoQueryKeys = {
  detail: (productId: string) =>
    ["products", "detail", productId, { seo_widget: true }] as const,
}

export const retrieveProductSeo = (productId: string) =>
  sdk.client.fetch<AdminProductSeoResponse>(`/admin/products/${productId}/seo`)

export const updateProductSeo = (
  productId: string,
  body: AdminUpdateProductSeoPayload
) =>
  sdk.client.fetch<AdminProductSeoResponse>(
    `/admin/products/${productId}/seo`,
    { method: "POST", body }
  )
