import {
  buildProductSeoChanges,
  productSeoFallbacks,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  seoCounter,
  toProductSeoForm,
} from "../utils"

const saved = (title: string | null, description: string | null) => ({
  title,
  description,
})

describe("SEO counter limits", () => {
  it("guides to 70 characters for the title and 160 for the description", () => {
    expect(SEO_TITLE_LIMIT).toBe(70)
    expect(SEO_DESCRIPTION_LIMIT).toBe(160)
  })
})

describe("seoCounter", () => {
  it("counts the characters used out of the limit", () => {
    expect(seoCounter("Red shoes", 70)).toEqual({
      count: 9,
      limit: 70,
      over: false,
      text: "9 of 70 characters used",
    })
  })

  it("counts an empty field as zero", () => {
    expect(seoCounter("", 160).text).toBe("0 of 160 characters used")
  })

  it("is not over the limit at exactly the limit", () => {
    expect(seoCounter("a".repeat(70), 70).over).toBe(false)
  })

  it("flags one character past the limit without cutting it", () => {
    expect(seoCounter("a".repeat(71), 70)).toMatchObject({
      count: 71,
      over: true,
      text: "71 of 70 characters used",
    })
  })

  it("leaves out surrounding spaces, which are not saved", () => {
    expect(seoCounter("  Red shoes  ", 70).count).toBe(9)
  })

  it("counts an emoji or accented letter as one character", () => {
    expect(seoCounter("Café 👟", 70).count).toBe(6)
  })
})

describe("toProductSeoForm", () => {
  it("fills the fields with what the admin set", () => {
    expect(
      toProductSeoForm({
        product_id: "prod_1",
        title: "SEO title",
        description: "SEO description",
        resolved: { title: "SEO title", description: "SEO description" },
      })
    ).toEqual({ title: "SEO title", description: "SEO description" })
  })

  it("leaves a field empty when it uses the fallback", () => {
    expect(
      toProductSeoForm({
        product_id: "prod_1",
        title: null,
        description: null,
        resolved: { title: "Product title", description: "Product text" },
      })
    ).toEqual({ title: "", description: "" })
  })
})

describe("buildProductSeoChanges", () => {
  it("is null when nothing changed", () => {
    expect(
      buildProductSeoChanges(saved("Title", null), {
        title: "Title",
        description: "",
      })
    ).toBeNull()
  })

  it("treats added surrounding spaces as no change", () => {
    expect(
      buildProductSeoChanges(saved("Title", "Text"), {
        title: " Title ",
        description: "Text  ",
      })
    ).toBeNull()
  })

  it("sends only the changed field, trimmed", () => {
    expect(
      buildProductSeoChanges(saved("Title", "Text"), {
        title: "  New title ",
        description: "Text",
      })
    ).toEqual({ title: "New title" })
  })

  it("sends both fields when both changed", () => {
    expect(
      buildProductSeoChanges(saved(null, null), {
        title: "Title",
        description: "Text",
      })
    ).toEqual({ title: "Title", description: "Text" })
  })

  it("sends null for an emptied field so it falls back again", () => {
    expect(
      buildProductSeoChanges(saved("Title", "Text"), {
        title: "",
        description: "   ",
      })
    ).toEqual({ title: null, description: null })
  })

  it("sends a value over the counter limit as is", () => {
    const long = "a".repeat(200)

    expect(
      buildProductSeoChanges(saved(null, null), { title: long, description: "" })
    ).toEqual({ title: long })
  })
})

describe("productSeoFallbacks", () => {
  it("uses the product title and its description on one line", () => {
    expect(
      productSeoFallbacks({
        title: "Red shoes",
        description: "Comfortable\n\nred   shoes",
      })
    ).toEqual({ title: "Red shoes", description: "Comfortable red shoes" })
  })

  it("cuts a long description to 160 characters at a word", () => {
    const description = `${"word ".repeat(40)}end`

    const fallback = productSeoFallbacks({ title: "T", description }).description

    expect(Array.from(fallback).length).toBeLessThanOrEqual(160)
    expect(fallback.endsWith("word")).toBe(true)
    expect(description.startsWith(fallback)).toBe(true)
  })

  it("has an empty description fallback when the product has none", () => {
    expect(
      productSeoFallbacks({ title: "Red shoes", description: null })
    ).toEqual({ title: "Red shoes", description: "" })
  })
})
