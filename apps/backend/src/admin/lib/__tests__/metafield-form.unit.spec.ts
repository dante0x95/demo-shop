import {
  buildProductMetafieldChanges,
  buildProductMetafieldFields,
  CreateMetafieldDefinitionFormState,
  formatMetafieldValue,
  ownerTypeLabel,
  parseSelectOptions,
  ProductMetafieldField,
  suggestMetafieldKey,
  toCreateMetafieldDefinitionPayload,
  toMetafieldInputValue,
} from "../metafield-form"

// The API's key rule (validators.ts of /admin/metafield-definitions).
const VALID_KEY = /^[a-z][a-z0-9_]{0,63}$/

describe("ownerTypeLabel", () => {
  it("capitalizes a single word", () => {
    expect(ownerTypeLabel("product")).toBe("Product")
  })

  it("turns underscores and dashes into spaces", () => {
    expect(ownerTypeLabel("product_variant")).toBe("Product variant")
    expect(ownerTypeLabel("gift-card")).toBe("Gift card")
  })

  it("keeps an owner type that has no words", () => {
    expect(ownerTypeLabel("_")).toBe("_")
  })
})

describe("suggestMetafieldKey", () => {
  it("turns a label into a snake_case key", () => {
    expect(suggestMetafieldKey("Care & Washing")).toBe("care_washing")
  })

  it("drops accents instead of the letters that carry them", () => {
    expect(suggestMetafieldKey("Composición del tejido")).toBe(
      "composicion_del_tejido"
    )
  })

  it("keeps digits after the first letter", () => {
    expect(suggestMetafieldKey("Size 2XL")).toBe("size_2xl")
  })

  it("starts with a letter even when the label starts with digits or symbols", () => {
    expect(suggestMetafieldKey("100% cotton")).toBe("cotton")
    expect(suggestMetafieldKey("  -- Origin")).toBe("origin")
  })

  it("has no trailing underscore", () => {
    expect(suggestMetafieldKey("Material!")).toBe("material")
  })

  it("is empty when the label has no letter", () => {
    expect(suggestMetafieldKey("")).toBe("")
    expect(suggestMetafieldKey("123 !!")).toBe("")
  })

  it("is cut to the 64 characters the API allows, without a trailing underscore", () => {
    const key = suggestMetafieldKey(`${"a".repeat(63)} b`)

    expect(key).toBe("a".repeat(63))
    expect(key).toMatch(VALID_KEY)
  })

  it("always gives a key the API accepts when it gives one", () => {
    for (const label of [
      "Ünïcödé Fïeld",
      "Disclosures",
      "a",
      "x".repeat(80),
      "9 lives & counting",
      "UPPER_case_Mixed",
    ]) {
      expect(suggestMetafieldKey(label)).toMatch(VALID_KEY)
    }
  })
})

describe("parseSelectOptions", () => {
  it("reads one option per line, trimmed", () => {
    expect(parseSelectOptions(" Cotton \nLinen\r\nWool")).toEqual([
      "Cotton",
      "Linen",
      "Wool",
    ])
  })

  it("ignores blank and whitespace-only lines", () => {
    expect(parseSelectOptions("\nCotton\n   \n\nLinen\n")).toEqual([
      "Cotton",
      "Linen",
    ])
  })

  it("is empty for empty text", () => {
    expect(parseSelectOptions("")).toEqual([])
  })
})

describe("toCreateMetafieldDefinitionPayload", () => {
  const form: CreateMetafieldDefinitionFormState = {
    label: "Fabric",
    key: " fabric ",
    type: "text",
    options: "",
  }

  it("sends the label, the trimmed key, the type and the owner type", () => {
    expect(toCreateMetafieldDefinitionPayload(form, "product")).toEqual({
      label: "Fabric",
      key: "fabric",
      type: "text",
      owner_type: "product",
    })
  })

  it("sends a select's options, one per line", () => {
    const payload = toCreateMetafieldDefinitionPayload(
      { ...form, type: "select", options: "Cotton\n\n Linen " },
      "product"
    )

    expect(payload.options).toEqual(["Cotton", "Linen"])
  })

  it("sends no options for other types, even when some were typed", () => {
    const payload = toCreateMetafieldDefinitionPayload(
      { ...form, type: "number", options: "Cotton" },
      "product"
    )

    expect(payload).not.toHaveProperty("options")
  })

  it("omits an unselected type so the API's 400 names it", () => {
    const payload = toCreateMetafieldDefinitionPayload(
      { ...form, type: "" },
      "product"
    )

    expect(payload).not.toHaveProperty("type")
  })

  it("sends an empty label as typed so the API reports it", () => {
    expect(
      toCreateMetafieldDefinitionPayload({ ...form, label: "" }, "product")
        .label
    ).toBe("")
  })
})

describe("buildProductMetafieldFields", () => {
  const definitions = [
    { key: "material", label: "Material", type: "select" as const, options: ["Cotton", "Linen"] },
    { key: "disclosures", label: "Disclosures", type: "text" as const, options: null },
    { key: "weight_g", label: "Weight (g)", type: "number" as const, options: null },
  ]

  it("lists every definition by key, with no value when the product has none", () => {
    const fields = buildProductMetafieldFields(definitions, [])

    expect(fields).toEqual([
      { key: "disclosures", label: "Disclosures", type: "text", options: null, value: null, unstructured: false },
      { key: "material", label: "Material", type: "select", options: ["Cotton", "Linen"], value: null, unstructured: false },
      { key: "weight_g", label: "Weight (g)", type: "number", options: null, value: null, unstructured: false },
    ])
  })

  it("fills in the product's values, keeping their JSON types", () => {
    const fields = buildProductMetafieldFields(definitions, [
      { key: "weight_g", type: "number", value: 0, definition: null },
      { key: "material", type: "select", value: "Linen", definition: null },
    ])

    expect(fields.map((f) => [f.key, f.value])).toEqual([
      ["disclosures", null],
      ["material", "Linen"],
      ["weight_g", 0],
    ])
  })

  it("lists unstructured values after the definitions, by key", () => {
    const fields = buildProductMetafieldFields(definitions, [
      { key: "zz_old", type: "boolean", value: false, definition: null },
      { key: "aa_old", type: "select", value: "Red", definition: null },
    ])

    expect(fields.slice(3)).toEqual([
      // Without its definition a select is edited as plain text.
      { key: "aa_old", label: "aa_old", type: "select", options: null, value: "Red", unstructured: true },
      { key: "zz_old", label: "zz_old", type: "boolean", options: null, value: false, unstructured: true },
    ])
  })

  it("keeps a value whose definition is newer than the loaded list as structured", () => {
    const fields = buildProductMetafieldFields(
      [],
      [
        {
          key: "color",
          type: "select",
          value: "Red",
          definition: {
            id: "mfdef_1",
            label: "Color",
            type: "select",
            options: ["Red", "Blue"],
            storefront_access: false,
          },
        },
      ]
    )

    expect(fields).toEqual([
      { key: "color", label: "Color", type: "select", options: ["Red", "Blue"], value: "Red", unstructured: false },
    ])
  })

  it("gives a select definition without stored options an empty list", () => {
    const [field] = buildProductMetafieldFields(
      [{ key: "size", label: "Size", type: "select", options: null }],
      []
    )

    expect(field.options).toEqual([])
  })
})

describe("formatMetafieldValue", () => {
  it("shows a dash for no value", () => {
    expect(formatMetafieldValue(null)).toBe("-")
  })

  it("shows booleans as True or False", () => {
    expect(formatMetafieldValue(true)).toBe("True")
    expect(formatMetafieldValue(false)).toBe("False")
  })

  it("shows numbers and text as they are, including zero", () => {
    expect(formatMetafieldValue(0)).toBe("0")
    expect(formatMetafieldValue(12.5)).toBe("12.5")
    expect(formatMetafieldValue("Cotton")).toBe("Cotton")
  })
})

describe("toMetafieldInputValue", () => {
  it("is empty for no value and text for any value", () => {
    expect(toMetafieldInputValue(null)).toBe("")
    expect(toMetafieldInputValue(false)).toBe("false")
    expect(toMetafieldInputValue(0)).toBe("0")
    expect(toMetafieldInputValue("Linen")).toBe("Linen")
  })
})

describe("buildProductMetafieldChanges", () => {
  const field = (overrides: Partial<ProductMetafieldField>): ProductMetafieldField => ({
    key: "fabric",
    label: "Fabric",
    type: "text",
    options: null,
    value: null,
    unstructured: false,
    ...overrides,
  })

  it("sends nothing when no input changed", () => {
    const fields = [
      field({ key: "a", value: "x" }),
      field({ key: "b", type: "number", value: 3 }),
      field({ key: "c", type: "boolean", value: false }),
      field({ key: "d" }),
    ]

    expect(
      buildProductMetafieldChanges(fields, { a: "x", b: "3", c: "false", d: "" })
    ).toEqual({ set: [], remove: [], errors: [] })
  })

  it("treats a missing input as unchanged", () => {
    expect(
      buildProductMetafieldChanges([field({ value: "x" })], {})
    ).toEqual({ set: [], remove: [], errors: [] })
  })

  it("sets each type with its JSON type", () => {
    const changes = buildProductMetafieldChanges(
      [
        field({ key: "text" }),
        field({ key: "num", type: "number" }),
        field({ key: "yes", type: "boolean" }),
        field({ key: "no", type: "boolean", value: true }),
        field({ key: "pick", type: "select", options: ["A", "B"] }),
      ],
      { text: "Hello", num: " 2.5 ", yes: "true", no: "false", pick: "B" }
    )

    expect(changes.set).toEqual([
      { key: "text", value: "Hello" },
      { key: "num", value: 2.5 },
      { key: "yes", value: true },
      { key: "no", value: false },
      { key: "pick", value: "B" },
    ])
    expect(changes.remove).toEqual([])
  })

  it("sets a number to zero", () => {
    expect(
      buildProductMetafieldChanges([field({ type: "number", value: 4 })], {
        fabric: "0",
      }).set
    ).toEqual([{ key: "fabric", value: 0 }])
  })

  it("keeps the spaces of a text value", () => {
    expect(
      buildProductMetafieldChanges([field({})], { fabric: " Linen " }).set
    ).toEqual([{ key: "fabric", value: " Linen " }])
  })

  it("removes a value whose input was emptied", () => {
    const changes = buildProductMetafieldChanges(
      [
        field({ key: "text", value: "x" }),
        field({ key: "num", type: "number", value: 0 }),
        field({ key: "flag", type: "boolean", value: false }),
      ],
      { text: "", num: "", flag: "" }
    )

    expect(changes.remove).toEqual(["text", "num", "flag"])
    expect(changes.set).toEqual([])
  })

  it("removes a text value emptied down to whitespace", () => {
    expect(
      buildProductMetafieldChanges([field({ value: "x" })], { fabric: "   " })
        .remove
    ).toEqual(["fabric"])
  })

  it("sends nothing for a field without a value left blank", () => {
    expect(
      buildProductMetafieldChanges([field({})], { fabric: "  " })
    ).toEqual({ set: [], remove: [], errors: [] })
  })

  it("edits an unstructured value like any other", () => {
    expect(
      buildProductMetafieldChanges(
        [field({ key: "old", type: "select", value: "Red", unstructured: true })],
        { old: "Green" }
      ).set
    ).toEqual([{ key: "old", value: "Green" }])
  })

  it("reports a number input that isn't a number and sends nothing for it", () => {
    const changes = buildProductMetafieldChanges(
      [field({ label: "Weight", type: "number" }), field({ key: "ok" })],
      { fabric: "abc", ok: "fine" }
    )

    expect(changes.errors).toEqual(["Weight must be a number"])
    expect(changes.set).toEqual([{ key: "ok", value: "fine" }])
  })
})
