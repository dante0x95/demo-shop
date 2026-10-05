import { sdk } from "./sdk"

// Mirrors `GET /admin/products/:id/variant-pricing` (T21). Every amount is in
// the store's default currency and stored as-is (49.99 = 49.99).
export type AdminVariantPricingVariant = {
  variant_id: string
  title: string
  sku: string | null
  // The variant's own price in the default currency, null when it has none.
  price: number | null
  // What the admin set; null = not set.
  compare_at_amount: number | null
  cost_amount: number | null
}

export type AdminVariantPricing = {
  product_id: string
  currency_code: string | null
  variants: AdminVariantPricingVariant[]
}

// A field left out keeps its stored value; null clears it.
export type AdminUpdateVariantPricingItem = {
  variant_id: string
  compare_at_amount?: number | null
  cost_amount?: number | null
}

export type AdminVariantPricingResponse = {
  variant_pricing: AdminVariantPricing
}

// Nested under the dashboard's product detail key (["products", "detail",
// id, ...]): editing the product's variants or prices on the product page
// invalidates that key, which refreshes this widget too.
export const variantPricingQueryKeys = {
  detail: (productId: string) =>
    ["products", "detail", productId, { variant_pricing_widget: true }] as const,
}

export const retrieveVariantPricing = (productId: string) =>
  sdk.client.fetch<AdminVariantPricingResponse>(
    `/admin/products/${productId}/variant-pricing`
  )

export const updateVariantPricing = (
  productId: string,
  variants: AdminUpdateVariantPricingItem[]
) =>
  sdk.client.fetch<AdminVariantPricingResponse>(
    `/admin/products/${productId}/variant-pricing`,
    { method: "POST", body: { variants } }
  )
