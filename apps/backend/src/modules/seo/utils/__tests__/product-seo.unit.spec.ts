import {
  fallbackMetaDescription,
  normalizeSeoValue,
  resolveProductSeo,
  truncateAtWord,
} from "../product-seo"

describe("normalizeSeoValue", () => {
  it("keeps undefined (not sent) and null (cleared)", () => {
    expect(normalizeSeoValue(undefined)).toBeUndefined()
    expect(normalizeSeoValue(null)).toBeNull()
  })

  it("trims surrounding whitespace", () => {
    expect(normalizeSeoValue("  Red shoes \n")).toBe("Red shoes")
  })

  it("clears empty and whitespace-only values", () => {
    expect(normalizeSeoValue("")).toBeNull()
    expect(normalizeSeoValue(" \t\n ")).toBeNull()
  })
})

describe("truncateAtWord", () => {
  it("returns text within the limit unchanged", () => {
    expect(truncateAtWord("short text", 10)).toBe("short text")
  })

  it("cuts back to the last space instead of splitting a word", () => {
    expect(truncateAtWord("one two three", 9)).toBe("one two")
  })

  it("keeps the whole last word when the cut falls right before a space", () => {
    expect(truncateAtWord("one two three", 7)).toBe("one two")
  })

  it("cuts hard when a single word is longer than the limit", () => {
    expect(truncateAtWord("abcdefghij", 4)).toBe("abcd")
  })

  it("counts code points, so emoji and accents are never split", () => {
    expect(truncateAtWord("😀😀😀😀", 2)).toBe("😀😀")
    expect(truncateAtWord("ñandú ñandú", 5)).toBe("ñandú")
  })
})

describe("fallbackMetaDescription", () => {
  it("is null when the product has no description", () => {
    expect(fallbackMetaDescription(null)).toBeNull()
    expect(fallbackMetaDescription(undefined)).toBeNull()
    expect(fallbackMetaDescription("   \n ")).toBeNull()
  })

  it("puts the description on one line", () => {
    expect(fallbackMetaDescription("  Soft cotton.\n\nMade in   Spain. ")).toBe(
      "Soft cotton. Made in Spain."
    )
  })

  it("cuts long descriptions to at most 160 characters on a word boundary", () => {
    const description = `${"word ".repeat(40)}end`
    const result = fallbackMetaDescription(description)!

    expect(Array.from(result).length).toBeLessThanOrEqual(160)
    expect(result).toBe("word ".repeat(32).trimEnd())
  })

  it("keeps a description of exactly 160 characters", () => {
    const description = "a".repeat(160)

    expect(fallbackMetaDescription(description)).toBe(description)
  })
})

describe("resolveProductSeo", () => {
  const product = { title: "Red Shoes", description: "Comfortable shoes." }

  it("falls back to the product title and description when nothing is set", () => {
    expect(resolveProductSeo(product)).toEqual({
      title: "Red Shoes",
      description: "Comfortable shoes.",
    })
    expect(resolveProductSeo(product, { title: null, description: null })).toEqual(
      { title: "Red Shoes", description: "Comfortable shoes." }
    )
  })

  it("uses the values the admin set, without length limits", () => {
    const longDescription = "x".repeat(400)

    expect(
      resolveProductSeo(product, {
        title: "Buy red shoes",
        description: longDescription,
      })
    ).toEqual({ title: "Buy red shoes", description: longDescription })
  })

  it("treats a blank stored value as not set", () => {
    expect(resolveProductSeo(product, { title: "  ", description: "" })).toEqual(
      { title: "Red Shoes", description: "Comfortable shoes." }
    )
  })

  it("has a null description when neither is available", () => {
    expect(resolveProductSeo({ title: "Red Shoes", description: null })).toEqual(
      { title: "Red Shoes", description: null }
    )
  })
})
