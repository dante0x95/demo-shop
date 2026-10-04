import { MedusaError } from "@medusajs/framework/utils"
import {
  findMetafieldReconnectConflict,
  isEmptyMetafieldValue,
  parseMetafieldValue,
  prepareMetafieldValues,
  resolveStorefrontMetafields,
  serializeMetafieldValue,
  toAdminMetafields,
} from "../values"

const catchError = (fn: () => unknown): MedusaError => {
  try {
    fn()
  } catch (error) {
    return error as MedusaError
  }
  throw new Error("Expected the call to throw")
}

describe("serializeMetafieldValue", () => {
  it.each([
    ["text", "Cotton", "Cotton"],
    ["text", "", ""],
    ["number", 12.5, "12.5"],
    ["number", 0, "0"],
    ["number", -3, "-3"],
    ["boolean", true, "true"],
    ["boolean", false, "false"],
    ["select", "slim", "slim"],
  ] as const)("stores a %s value %p as %p", (type, value, stored) => {
    expect(
      serializeMetafieldValue("fabric", type, value, type === "select" ? ["slim"] : null)
    ).toBe(stored)
  })

  it.each([
    ["text", 12],
    ["text", true],
    ["number", "12"],
    ["number", Number.NaN],
    ["number", Number.POSITIVE_INFINITY],
    ["boolean", "true"],
    ["boolean", 1],
    ["select", 1],
    ["text", null],
  ] as const)("rejects a %s value %p with a 400", (type, value) => {
    const error = catchError(() =>
      serializeMetafieldValue("fabric", type, value)
    )

    expect(error.type).toBe(MedusaError.Types.INVALID_DATA)
    expect(error.message).toContain(`Metafield fabric is of type ${type}`)
  })

  it("rejects a select value outside the options, listing them", () => {
    const error = catchError(() =>
      serializeMetafieldValue("fit", "select", "baggy", ["slim", "regular"])
    )

    expect(error.type).toBe(MedusaError.Types.INVALID_DATA)
    expect(error.message).toBe(
      'Metafield fit must be one of its options: "slim", "regular"'
    )
  })

  it("checks a select without options as plain text", () => {
    expect(serializeMetafieldValue("fit", "select", "baggy")).toBe("baggy")
  })
})

describe("parseMetafieldValue", () => {
  it("restores the JSON type of each stored value", () => {
    expect(parseMetafieldValue("number", "12.5")).toBe(12.5)
    expect(parseMetafieldValue("boolean", "true")).toBe(true)
    expect(parseMetafieldValue("boolean", "false")).toBe(false)
    expect(parseMetafieldValue("text", "42")).toBe("42")
    expect(parseMetafieldValue("select", "slim")).toBe("slim")
  })
})

describe("isEmptyMetafieldValue", () => {
  it("treats blank text and select values as empty", () => {
    expect(isEmptyMetafieldValue("text", "")).toBe(true)
    expect(isEmptyMetafieldValue("text", "  \n")).toBe(true)
    expect(isEmptyMetafieldValue("select", "")).toBe(true)
  })

  it("never treats numbers, booleans or real text as empty", () => {
    expect(isEmptyMetafieldValue("number", "0")).toBe(false)
    expect(isEmptyMetafieldValue("boolean", "false")).toBe(false)
    expect(isEmptyMetafieldValue("text", " a ")).toBe(false)
  })
})

describe("prepareMetafieldValues", () => {
  const definitions = [
    { key: "fabric", type: "text" as const, options: null },
    { key: "fit", type: "select" as const, options: ["slim", "regular"] },
    { key: "weight", type: "number" as const, options: null },
  ]

  it("uses each definition's type and options", () => {
    expect(
      prepareMetafieldValues(
        "product",
        [
          { key: "fabric", value: "Cotton" },
          { key: "fit", value: "slim" },
          { key: "weight", value: 1.5 },
        ],
        definitions,
        []
      )
    ).toEqual([
      { key: "fabric", type: "text", value: "Cotton" },
      { key: "fit", type: "select", value: "slim" },
      { key: "weight", type: "number", value: "1.5" },
    ])
  })

  it("prefers the definition's type over the stored value's", () => {
    expect(
      prepareMetafieldValues(
        "product",
        [{ key: "fabric", value: "Wool" }],
        definitions,
        [{ key: "fabric", type: "number" }]
      )
    ).toEqual([{ key: "fabric", type: "text", value: "Wool" }])
  })

  it("rejects a select value outside its definition's options", () => {
    expect(() =>
      prepareMetafieldValues(
        "product",
        [{ key: "fit", value: "baggy" }],
        definitions,
        []
      )
    ).toThrow("Metafield fit must be one of its options")
  })

  it("edits an unstructured value against its stored type", () => {
    expect(
      prepareMetafieldValues(
        "product",
        [{ key: "legacy_count", value: 3 }],
        definitions,
        [{ key: "legacy_count", type: "number" }]
      )
    ).toEqual([{ key: "legacy_count", type: "number", value: "3" }])

    expect(() =>
      prepareMetafieldValues(
        "product",
        [{ key: "legacy_count", value: "three" }],
        definitions,
        [{ key: "legacy_count", type: "number" }]
      )
    ).toThrow("Metafield legacy_count is of type number")
  })

  it("checks an unstructured select as plain text", () => {
    expect(
      prepareMetafieldValues(
        "product",
        [{ key: "old_fit", value: "anything" }],
        definitions,
        [{ key: "old_fit", type: "select" }]
      )
    ).toEqual([{ key: "old_fit", type: "select", value: "anything" }])
  })

  it("rejects a key with neither a definition nor a value", () => {
    const error = catchError(() =>
      prepareMetafieldValues(
        "product",
        [{ key: "unknown", value: "x" }],
        definitions,
        []
      )
    )

    expect(error.type).toBe(MedusaError.Types.INVALID_DATA)
    expect(error.message).toBe(
      "No metafield definition with key unknown exists for owner type product"
    )
  })
})

describe("findMetafieldReconnectConflict", () => {
  it("allows a definition when there are no values", () => {
    expect(
      findMetafieldReconnectConflict({ key: "fabric", type: "text" }, [])
    ).toBeNull()
  })

  it("allows values of the same type", () => {
    expect(
      findMetafieldReconnectConflict({ key: "fabric", type: "text" }, [
        { type: "text", value: "Cotton" },
      ])
    ).toBeNull()
  })

  it("rejects values of another type, naming it", () => {
    expect(
      findMetafieldReconnectConflict({ key: "fabric", type: "text" }, [
        { type: "number", value: "1" },
        { type: "text", value: "Cotton" },
        { type: "number", value: "2" },
      ])
    ).toBe(
      "Metafield definition fabric can't be of type text: existing values with this key are of type number"
    )
  })

  it("allows a select whose options include every existing value", () => {
    expect(
      findMetafieldReconnectConflict(
        { key: "fit", type: "select", options: ["slim", "regular"] },
        [
          { type: "select", value: "slim" },
          { type: "select", value: "regular" },
        ]
      )
    ).toBeNull()
  })

  it("rejects a select missing existing values, listing each once", () => {
    expect(
      findMetafieldReconnectConflict(
        { key: "fit", type: "select", options: ["slim"] },
        [
          { type: "select", value: "slim" },
          { type: "select", value: "regular" },
          { type: "select", value: "baggy" },
          { type: "select", value: "regular" },
        ]
      )
    ).toBe(
      'Metafield definition fit needs every existing value among its options; missing: "baggy", "regular"'
    )
  })

  it("counts the missing values beyond the first ten", () => {
    const values = Array.from({ length: 12 }, (_, i) => ({
      type: "select" as const,
      value: `v${String(i).padStart(2, "0")}`,
    }))

    expect(
      findMetafieldReconnectConflict(
        { key: "fit", type: "select", options: [] },
        values
      )
    ).toMatch(/"v09" and 2 more$/)
  })
})

describe("resolveStorefrontMetafields", () => {
  const definitions = [
    { key: "fabric", type: "text" as const, storefront_access: true },
    { key: "care", type: "text" as const, storefront_access: false },
    { key: "weight", type: "number" as const, storefront_access: true },
    { key: "organic", type: "boolean" as const, storefront_access: true },
    { key: "note", type: "text" as const, storefront_access: true },
  ]

  const values = [
    { key: "fabric", type: "text" as const, value: "Cotton" },
    { key: "care", type: "text" as const, value: "Hand wash" },
    { key: "weight", type: "number" as const, value: "1.5" },
    { key: "organic", type: "boolean" as const, value: "false" },
    { key: "note", type: "text" as const, value: "  " },
    { key: "legacy", type: "text" as const, value: "Old" },
  ]

  it("returns every requested key, typed, and null when not public", () => {
    expect(
      resolveStorefrontMetafields(
        ["fabric", "care", "weight", "organic", "note", "legacy", "missing"],
        definitions,
        values
      )
    ).toEqual({
      fabric: "Cotton",
      care: null,
      weight: 1.5,
      organic: false,
      note: null,
      legacy: null,
      missing: null,
    })
  })

  it("is null when the stored type no longer matches the definition", () => {
    expect(
      resolveStorefrontMetafields(
        ["weight"],
        definitions,
        [{ key: "weight", type: "text", value: "heavy" }]
      )
    ).toEqual({ weight: null })
  })

  it("keeps a key named like an Object prototype property as data", () => {
    const result = resolveStorefrontMetafields(["__proto__"], [], [])

    expect(Object.keys(result)).toEqual(["__proto__"])
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
  })
})

describe("toAdminMetafields", () => {
  it("orders values by key and attaches their definitions", () => {
    const result = toAdminMetafields(
      [
        {
          id: "mfval_2",
          key: "weight",
          type: "number",
          value: "2",
          created_at: "c2",
          updated_at: "u2",
        },
        {
          id: "mfval_1",
          key: "legacy",
          type: "text",
          value: "Old",
          created_at: "c1",
          updated_at: "u1",
        },
      ],
      [
        {
          id: "mfdef_1",
          key: "weight",
          label: "Weight",
          type: "number",
          options: null,
          storefront_access: true,
        },
      ]
    )

    expect(result).toEqual([
      {
        id: "mfval_1",
        key: "legacy",
        type: "text",
        value: "Old",
        definition: null,
        created_at: "c1",
        updated_at: "u1",
      },
      {
        id: "mfval_2",
        key: "weight",
        type: "number",
        value: 2,
        definition: {
          id: "mfdef_1",
          label: "Weight",
          type: "number",
          options: null,
          storefront_access: true,
        },
        created_at: "c2",
        updated_at: "u2",
      },
    ])
  })
})
