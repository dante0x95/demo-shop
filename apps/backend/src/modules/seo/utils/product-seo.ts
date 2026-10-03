// Length the product description is cut to when it stands in for an unset
// meta description. The API enforces no limit on values the admin sets.
export const META_DESCRIPTION_FALLBACK_LENGTH = 160

export type ProductSeoValues = {
  title?: string | null
  description?: string | null
}

export type ResolvedProductSeo = {
  title: string
  description: string | null
}

// What the admin sent, as stored: surrounding whitespace is trimmed, and an
// empty or whitespace-only value clears the field (null), so it falls back
// again. `undefined` means "not sent" and leaves the stored value as it is.
export const normalizeSeoValue = (
  value: string | null | undefined
): string | null | undefined => {
  if (value === undefined || value === null) {
    return value
  }

  const trimmed = value.trim()

  return trimmed.length ? trimmed : null
}

// Cuts `text` to at most `maxLength` characters (code points, so emoji and
// accented letters are never split) without breaking a word: the cut moves
// back to the last space. A single word longer than the limit is cut hard.
export const truncateAtWord = (text: string, maxLength: number): string => {
  const chars = Array.from(text)

  if (chars.length <= maxLength) {
    return text
  }

  const kept = chars.slice(0, maxLength)

  if (chars[maxLength] === " ") {
    return kept.join("").trimEnd()
  }

  const lastSpace = kept.lastIndexOf(" ")

  if (lastSpace <= 0) {
    return kept.join("")
  }

  return kept.slice(0, lastSpace).join("").trimEnd()
}

// The meta description a product falls back to: its description on one line
// (newlines and repeated spaces collapsed), cut to 160 characters.
export const fallbackMetaDescription = (
  description: string | null | undefined
): string | null => {
  const singleLine = (description ?? "").replace(/\s+/g, " ").trim()

  if (!singleLine) {
    return null
  }

  return truncateAtWord(singleLine, META_DESCRIPTION_FALLBACK_LENGTH)
}

// The SEO values a storefront renders: what the admin set, else the product's
// title and its description cut to 160 characters. The title is never empty.
export const resolveProductSeo = (
  product: { title: string; description?: string | null },
  seo?: ProductSeoValues | null
): ResolvedProductSeo => ({
  title: normalizeSeoValue(seo?.title) ?? product.title,
  description:
    normalizeSeoValue(seo?.description) ??
    fallbackMetaDescription(product.description),
})
