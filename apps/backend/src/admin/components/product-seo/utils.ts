// Type-only imports from the SDK client: this file stays free of the SDK so
// unit tests can load it.
import type {
  AdminProductSeo,
  AdminUpdateProductSeoPayload,
} from "../../lib/product-seo"
import {
  fallbackMetaDescription,
  normalizeSeoValue,
} from "../../../modules/seo/utils/product-seo"

// Shopify-style counters (T22): a guide only. The API enforces no limit, so a
// longer value is still saved.
export const SEO_TITLE_LIMIT = 70
export const SEO_DESCRIPTION_LIMIT = 160

export type ProductSeoForm = {
  title: string
  description: string
}

export type SeoCounter = {
  count: number
  limit: number
  over: boolean
  text: string
}

// Counts what will be saved: surrounding whitespace is trimmed, and
// characters are code points so an emoji or accented letter counts once.
export const seoCounter = (value: string, limit: number): SeoCounter => {
  const count = Array.from(value.trim()).length

  return {
    count,
    limit,
    over: count > limit,
    text: `${count} of ${limit} characters used`,
  }
}

export const toProductSeoForm = (seo: AdminProductSeo): ProductSeoForm => ({
  title: seo.title ?? "",
  description: seo.description ?? "",
})

// What to send: only the fields that changed, so a value someone else saved
// meanwhile is kept. Emptying a field sends null, which goes back to the
// fallback. Null when nothing changed.
export const buildProductSeoChanges = (
  seo: Pick<AdminProductSeo, "title" | "description">,
  form: ProductSeoForm
): AdminUpdateProductSeoPayload | null => {
  const changes: AdminUpdateProductSeoPayload = {}
  const title = normalizeSeoValue(form.title) ?? null
  const description = normalizeSeoValue(form.description) ?? null

  if (title !== seo.title) {
    changes.title = title
  }

  if (description !== seo.description) {
    changes.description = description
  }

  return Object.keys(changes).length ? changes : null
}

// What the storefront uses while a field is empty (T22's fallbacks), shown
// as the field's placeholder.
export const productSeoFallbacks = (product: {
  title?: string | null
  description?: string | null
}) => ({
  title: product.title ?? "",
  description: fallbackMetaDescription(product.description) ?? "",
})
