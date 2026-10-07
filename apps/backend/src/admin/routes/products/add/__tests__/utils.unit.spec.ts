import {
  addMedia,
  AddProductContext,
  AddProductForm,
  AMOUNT_ERROR,
  buildCreateProductFullPayload,
  buildFollowUpRequests,
  buildVariantCombinations,
  DEFAULT_OPTION_TITLE,
  DEFAULT_OPTION_VALUE,
  DEFAULT_VARIANT_KEY,
  DEFAULT_VARIANT_TITLE,
  effectiveThumbnailId,
  emptyAddProductForm,
  emptyVariantRow,
  followUpParts,
  MEASURE_ERROR,
  NO_CURRENCY_ERROR,
  OPTION_DUPLICATE_ERROR,
  OPTION_TITLE_ERROR,
  OPTION_VALUES_ERROR,
  OptionFormRow,
  parseOptionValues,
  parseQuantityInput,
  QUANTITY_ERROR,
  removeMedia,
  TITLE_ERROR,
  VariantFormRow,
} from "../utils"

const ctx = (
  overrides: Partial<AddProductContext> = {}
): AddProductContext => ({
  currency_code: "usd",
  location_ids: ["sloc_a", "sloc_b"],
  metafield_definitions: [],
  ...overrides,
})

const form = (overrides: Partial<AddProductForm> = {}): AddProductForm => ({
  ...emptyAddProductForm(),
  title: "Basic Tee",
  ...overrides,
})

const row = (overrides: Partial<VariantFormRow> = {}): VariantFormRow => ({
  ...emptyVariantRow(),
  ...overrides,
})

const option = (key: string, title: string, values: string): OptionFormRow => ({
  key,
  title,
  values,
})

const SIZE_COLOR = [
  option("1", "Size", "S, M"),
  option("2", "Color", "Red, Blue"),
]

// The key of the variant with these values (as the page stores its inputs).
const keyOf = (options: OptionFormRow[], title: string) => {
  const combination = buildVariantCombinations(options).find(
    (item) => item.title === title
  )
  expect(combination).toBeTruthy()
  return combination!.key
}

const expectPayload = (
  result: ReturnType<typeof buildCreateProductFullPayload>
) => {
  expect(result.errors).toBeNull()
  return result.payload!
}

const expectErrors = (
  result: ReturnType<typeof buildCreateProductFullPayload>
) => {
  expect(result.payload).toBeNull()
  return result.errors!
}

describe("parseOptionValues", () => {
  it("splits on commas, trimming each value", () => {
    expect(parseOptionValues(" S, M ,L ")).toEqual(["S", "M", "L"])
  })

  it("drops blank and repeated values, keeping the first occurrence", () => {
    expect(parseOptionValues("S,, M, S, ,L")).toEqual(["S", "M", "L"])
  })

  it("returns no values for an empty or blank input", () => {
    expect(parseOptionValues("")).toEqual([])
    expect(parseOptionValues(" , ")).toEqual([])
  })
})

describe("parseQuantityInput", () => {
  it("reads whole numbers, including 0", () => {
    expect(parseQuantityInput("12")).toBe(12)
    expect(parseQuantityInput(" 0 ")).toBe(0)
  })

  it("treats an empty input as no stock (null)", () => {
    expect(parseQuantityInput("")).toBeNull()
    expect(parseQuantityInput("   ")).toBeNull()
  })

  it("rejects negatives, decimals, exponents and text", () => {
    for (const input of ["-1", "1.5", "1e3", "ten", "+3"]) {
      expect(parseQuantityInput(input)).toBeUndefined()
    }
  })
})

describe("buildVariantCombinations", () => {
  it("is the single default variant when there are no options", () => {
    expect(buildVariantCombinations([])).toEqual([
      {
        key: DEFAULT_VARIANT_KEY,
        title: DEFAULT_VARIANT_TITLE,
        options: { [DEFAULT_OPTION_TITLE]: DEFAULT_OPTION_VALUE },
      },
    ])
  })

  it("ignores options without a name or without values", () => {
    const combinations = buildVariantCombinations([
      option("1", "", "S, M"),
      option("2", "Color", " , "),
    ])

    expect(combinations.map((item) => item.title)).toEqual([
      DEFAULT_VARIANT_TITLE,
    ])
  })

  it("makes one variant per value of a single option", () => {
    const combinations = buildVariantCombinations([
      option("1", " Size ", "S, M"),
    ])

    expect(
      combinations.map(({ title, options }) => ({ title, options }))
    ).toEqual([
      { title: "S", options: { Size: "S" } },
      { title: "M", options: { Size: "M" } },
    ])
  })

  it("makes every combination of several options, the first varying slowest", () => {
    const combinations = buildVariantCombinations(SIZE_COLOR)

    expect(
      combinations.map(({ title, options }) => ({ title, options }))
    ).toEqual([
      { title: "S / Red", options: { Size: "S", Color: "Red" } },
      { title: "S / Blue", options: { Size: "S", Color: "Blue" } },
      { title: "M / Red", options: { Size: "M", Color: "Red" } },
      { title: "M / Blue", options: { Size: "M", Color: "Blue" } },
    ])
    expect(new Set(combinations.map((item) => item.key)).size).toBe(4)
  })

  it("keeps a variant's key when an option is renamed, so its inputs stay", () => {
    const before = buildVariantCombinations([option("1", "Size", "S")])
    const after = buildVariantCombinations([option("1", "Talla", "S")])

    expect(after[0].key).toBe(before[0].key)
    expect(after[0].key).not.toBe(DEFAULT_VARIANT_KEY)
  })
})

describe("buildCreateProductFullPayload", () => {
  it("creates a draft with the default option and variant from a title alone", () => {
    const payload = expectPayload(buildCreateProductFullPayload(form(), ctx()))

    expect(payload).toEqual({
      title: "Basic Tee",
      status: "draft",
      options: [
        { title: DEFAULT_OPTION_TITLE, values: [DEFAULT_OPTION_VALUE] },
      ],
      variants: [
        {
          title: DEFAULT_VARIANT_TITLE,
          manage_inventory: true,
          options: { [DEFAULT_OPTION_TITLE]: DEFAULT_OPTION_VALUE },
          prices: [],
        },
      ],
    })
  })

  it("requires a title that isn't blank", () => {
    expect(
      expectErrors(buildCreateProductFullPayload(form({ title: "  " }), ctx()))
    ).toEqual({
      title: TITLE_ERROR,
    })
  })

  it("trims the title, description and handle, and leaves blank ones out", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({ title: "  Tee ", description: " Soft cotton ", handle: "  " }),
        ctx()
      )
    )

    expect(payload.title).toBe("Tee")
    expect(payload.description).toBe("Soft cotton")
    expect(payload).not.toHaveProperty("handle")
  })

  it("sends every organization, media and shipping field the admin set", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({
          handle: "basic-tee",
          status: "published",
          media_ids: ["media_1", "media_2"],
          thumbnail_id: "media_2",
          category_ids: ["pcat_1", "pcat_2"],
          tag_ids: ["ptag_1"],
          sales_channel_ids: ["sc_1"],
          type_id: "ptyp_1",
          collection_id: "pcol_1",
          brand_id: "brand_1",
          shipping: {
            package_preset_id: "pkg_1",
            shipping_profile_id: "sp_1",
            weight: "0.5",
            length: "30",
            width: "20",
            height: "0",
            origin_country: "ar",
            hs_code: " 6109.10 ",
          },
        }),
        ctx()
      )
    )

    expect(payload).toMatchObject({
      handle: "basic-tee",
      status: "published",
      images: ["media_1", "media_2"],
      thumbnail_id: "media_2",
      categories: [{ id: "pcat_1" }, { id: "pcat_2" }],
      tags: [{ id: "ptag_1" }],
      sales_channels: [{ id: "sc_1" }],
      type_id: "ptyp_1",
      collection_id: "pcol_1",
      shipping_profile_id: "sp_1",
      weight: 0.5,
      length: 30,
      width: 20,
      height: 0,
      origin_country: "ar",
      hs_code: "6109.10",
      additional_data: { brand_id: "brand_1" },
    })
    // The package is saved after the product exists (T23's endpoint).
    expect(JSON.stringify(payload)).not.toContain("pkg_1")
  })

  it("sends no sales channel when the admin removed them all", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(form({ sales_channel_ids: [] }), ctx())
    )

    expect(payload).not.toHaveProperty("sales_channels")
  })

  it("leaves out a thumbnail that isn't one of the product's media", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({ media_ids: ["media_1"], thumbnail_id: "media_gone" }),
        ctx()
      )
    )

    expect(payload.images).toEqual(["media_1"])
    expect(payload).not.toHaveProperty("thumbnail_id")
  })

  it("prices the variant in the store's default currency", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({
          variants: { [DEFAULT_VARIANT_KEY]: row({ price: " 49.99 " }) },
        }),
        ctx({ currency_code: "eur" })
      )
    )

    expect(payload.variants[0].prices).toEqual([
      { currency_code: "eur", amount: 49.99 },
    ])
  })

  it("accepts a price of 0", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({ variants: { [DEFAULT_VARIANT_KEY]: row({ price: "0" }) } }),
        ctx()
      )
    )

    expect(payload.variants[0].prices).toEqual([
      { currency_code: "usd", amount: 0 },
    ])
  })

  it("rejects a price that isn't a plain amount", () => {
    for (const price of ["-5", "1,000", "abc", "1e2"]) {
      const errors = expectErrors(
        buildCreateProductFullPayload(
          form({ variants: { [DEFAULT_VARIANT_KEY]: row({ price }) } }),
          ctx()
        )
      )

      expect(errors).toEqual({
        [`variants.${DEFAULT_VARIANT_KEY}.price`]: AMOUNT_ERROR,
      })
    }
  })

  it("can't price a variant when the store has no default currency", () => {
    const errors = expectErrors(
      buildCreateProductFullPayload(
        form({ variants: { [DEFAULT_VARIANT_KEY]: row({ price: "10" }) } }),
        ctx({ currency_code: null })
      )
    )

    expect(errors).toEqual({
      [`variants.${DEFAULT_VARIANT_KEY}.price`]: NO_CURRENCY_ERROR,
    })
  })

  it("creates an unpriced variant without a currency when no price is typed", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(form(), ctx({ currency_code: null }))
    )

    expect(payload.variants[0].prices).toEqual([])
  })

  it("checks compare-at and cost before creating, without sending them yet", () => {
    const errors = expectErrors(
      buildCreateProductFullPayload(
        form({
          variants: {
            [DEFAULT_VARIANT_KEY]: row({
              compare_at_amount: "abc",
              cost_amount: "-1",
            }),
          },
        }),
        ctx()
      )
    )

    expect(errors).toEqual({
      [`variants.${DEFAULT_VARIANT_KEY}.compare_at_amount`]: AMOUNT_ERROR,
      [`variants.${DEFAULT_VARIANT_KEY}.cost_amount`]: AMOUNT_ERROR,
    })

    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({
          variants: {
            [DEFAULT_VARIANT_KEY]: row({
              compare_at_amount: "80",
              cost_amount: "20",
            }),
          },
        }),
        ctx()
      )
    )

    expect(payload.variants[0]).not.toHaveProperty("compare_at_amount")
    expect(payload.variants[0]).not.toHaveProperty("cost_amount")
  })

  it("sends stock only for the locations with a quantity", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({
          variants: {
            [DEFAULT_VARIANT_KEY]: row({ stock: { sloc_a: "0", sloc_b: "" } }),
          },
        }),
        ctx()
      )
    )

    expect(payload.variants[0]).toMatchObject({
      manage_inventory: true,
      stock: [{ location_id: "sloc_a", quantity: 0 }],
    })
  })

  it("ignores quantities for locations the page doesn't list", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({
          variants: {
            [DEFAULT_VARIANT_KEY]: row({
              stock: { sloc_deleted: "4", sloc_b: "2" },
            }),
          },
        }),
        ctx()
      )
    )

    expect(payload.variants[0].stock).toEqual([
      { location_id: "sloc_b", quantity: 2 },
    ])
  })

  it("reports each invalid quantity by variant and location", () => {
    const errors = expectErrors(
      buildCreateProductFullPayload(
        form({
          variants: {
            [DEFAULT_VARIANT_KEY]: row({
              stock: { sloc_a: "1.5", sloc_b: "-2" },
            }),
          },
        }),
        ctx()
      )
    )

    expect(errors).toEqual({
      [`variants.${DEFAULT_VARIANT_KEY}.stock.sloc_a`]: QUANTITY_ERROR,
      [`variants.${DEFAULT_VARIANT_KEY}.stock.sloc_b`]: QUANTITY_ERROR,
    })
  })

  it("doesn't track inventory or send stock when tracking is off", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({
          track_inventory: false,
          variants: {
            [DEFAULT_VARIANT_KEY]: row({ stock: { sloc_a: "abc" } }),
          },
        }),
        ctx()
      )
    )

    expect(payload.variants[0].manage_inventory).toBe(false)
    expect(payload.variants[0]).not.toHaveProperty("stock")
  })

  it("sends trimmed SKU and barcode, and leaves blank ones out", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({
          variants: {
            [DEFAULT_VARIANT_KEY]: row({ sku: " TEE-1 ", barcode: "  " }),
          },
        }),
        ctx()
      )
    )

    expect(payload.variants[0].sku).toBe("TEE-1")
    expect(payload.variants[0]).not.toHaveProperty("barcode")
  })

  it("sends the options and one variant per combination with its own inputs", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({
          options: SIZE_COLOR,
          variants: {
            [keyOf(SIZE_COLOR, "S / Red")]: row({
              price: "10",
              sku: "TEE-S-RED",
              stock: { sloc_a: "3" },
            }),
            [keyOf(SIZE_COLOR, "M / Blue")]: row({
              price: "12",
              barcode: "123",
            }),
          },
        }),
        ctx()
      )
    )

    expect(payload.options).toEqual([
      { title: "Size", values: ["S", "M"] },
      { title: "Color", values: ["Red", "Blue"] },
    ])
    expect(payload.variants).toEqual([
      {
        title: "S / Red",
        sku: "TEE-S-RED",
        manage_inventory: true,
        options: { Size: "S", Color: "Red" },
        prices: [{ currency_code: "usd", amount: 10 }],
        stock: [{ location_id: "sloc_a", quantity: 3 }],
      },
      {
        title: "S / Blue",
        manage_inventory: true,
        options: { Size: "S", Color: "Blue" },
        prices: [],
      },
      {
        title: "M / Red",
        manage_inventory: true,
        options: { Size: "M", Color: "Red" },
        prices: [],
      },
      {
        title: "M / Blue",
        barcode: "123",
        manage_inventory: true,
        options: { Size: "M", Color: "Blue" },
        prices: [{ currency_code: "usd", amount: 12 }],
      },
    ])
  })

  it("doesn't send the inputs of a variant whose value was removed", () => {
    const options = [option("1", "Size", "S")]
    const removedKey = keyOf([option("1", "Size", "S, M")], "M")
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({ options, variants: { [removedKey]: row({ sku: "TEE-M" }) } }),
        ctx()
      )
    )

    expect(payload.variants.map((variant) => variant.title)).toEqual(["S"])
    expect(JSON.stringify(payload)).not.toContain("TEE-M")
  })

  it("ignores an option row left empty", () => {
    const payload = expectPayload(
      buildCreateProductFullPayload(
        form({ options: [option("1", " ", "")] }),
        ctx()
      )
    )

    expect(payload.options).toEqual([
      { title: DEFAULT_OPTION_TITLE, values: [DEFAULT_OPTION_VALUE] },
    ])
  })

  it("asks for an option's name and values when only one of them is set", () => {
    const errors = expectErrors(
      buildCreateProductFullPayload(
        form({
          options: [option("1", "", "S, M"), option("2", "Color", " , ")],
        }),
        ctx()
      )
    )

    expect(errors).toEqual({
      "options.1.title": OPTION_TITLE_ERROR,
      "options.2.values": OPTION_VALUES_ERROR,
    })
  })

  it("rejects two options with the same name, whatever the case", () => {
    const errors = expectErrors(
      buildCreateProductFullPayload(
        form({
          options: [option("1", "Size", "S"), option("2", " size ", "M")],
        }),
        ctx()
      )
    )

    expect(errors).toEqual({ "options.2.title": OPTION_DUPLICATE_ERROR })
  })

  it("rejects size and weight values that aren't numbers of 0 or more", () => {
    const errors = expectErrors(
      buildCreateProductFullPayload(
        form({
          shipping: {
            ...emptyAddProductForm().shipping,
            weight: "-1",
            length: "abc",
            width: "2",
            height: "",
          },
        }),
        ctx()
      )
    )

    expect(errors).toEqual({
      "shipping.weight": MEASURE_ERROR,
      "shipping.length": MEASURE_ERROR,
    })
  })

  it("checks metafield values against their definition's type", () => {
    const errors = expectErrors(
      buildCreateProductFullPayload(
        form({ metafields: { weight_grams: "heavy", care: "Hand wash" } }),
        ctx({
          metafield_definitions: [
            {
              key: "weight_grams",
              label: "Weight (g)",
              type: "number",
              options: null,
            },
            { key: "care", label: "Care", type: "text", options: null },
          ],
        })
      )
    )

    expect(errors).toEqual({
      "metafields.weight_grams": "Weight (g) must be a number",
    })
  })

  it("reports every invalid field at once", () => {
    const errors = expectErrors(
      buildCreateProductFullPayload(
        form({
          title: "",
          variants: { [DEFAULT_VARIANT_KEY]: row({ price: "x" }) },
          shipping: { ...emptyAddProductForm().shipping, weight: "x" },
        }),
        ctx()
      )
    )

    expect(Object.keys(errors).sort()).toEqual(
      [
        "shipping.weight",
        "title",
        `variants.${DEFAULT_VARIANT_KEY}.price`,
      ].sort()
    )
  })
})

// A created variant as the API returns it: identified by its option values.
const createdVariant = (id: string, options: Record<string, string>) => ({
  id,
  options: Object.entries(options).map(([title, value]) => ({
    value,
    option: { title },
  })),
})

const DEFAULT_CREATED = createdVariant("variant_1", {
  [DEFAULT_OPTION_TITLE]: DEFAULT_OPTION_VALUE,
})

describe("buildFollowUpRequests", () => {
  const created = [
    createdVariant("variant_s", { Size: "S" }),
    createdVariant("variant_m", { Size: "M" }),
  ]
  const sizes = [option("1", "Size", "S, M")]

  it("has nothing to save when only core fields were set", () => {
    const requests = buildFollowUpRequests(form(), ctx(), [DEFAULT_CREATED])

    expect(requests).toEqual({
      pricing: null,
      metafields: null,
      seo: null,
      package: null,
      unmatched_variants: [],
    })
    expect(followUpParts(requests)).toEqual([])
  })

  it("sends compare-at and cost to the created variants, matched by option values", () => {
    const requests = buildFollowUpRequests(
      form({
        options: sizes,
        variants: {
          [keyOf(sizes, "S")]: row({
            compare_at_amount: "80",
            cost_amount: "",
          }),
          [keyOf(sizes, "M")]: row({
            compare_at_amount: "",
            cost_amount: "12.5",
          }),
        },
      }),
      ctx(),
      created
    )

    expect(requests.pricing).toEqual([
      { variant_id: "variant_s", compare_at_amount: 80 },
      { variant_id: "variant_m", cost_amount: 12.5 },
    ])
    expect(requests.unmatched_variants).toEqual([])
  })

  it("tells apart combinations whose titles are the same", () => {
    // Both combinations are titled "A / B / C".
    const options = [
      option("1", "Style", "A / B, A"),
      option("2", "Size", "C, B / C"),
    ]
    const first = keyOf(options, "A / B / C")
    const requests = buildFollowUpRequests(
      form({ options, variants: { [first]: row({ cost_amount: "10" }) } }),
      ctx(),
      [
        createdVariant("variant_ab_c", { Style: "A / B", Size: "C" }),
        createdVariant("variant_ab_bc", { Style: "A / B", Size: "B / C" }),
        createdVariant("variant_a_c", { Style: "A", Size: "C" }),
        createdVariant("variant_a_bc", { Style: "A", Size: "B / C" }),
      ]
    )

    expect(requests.pricing).toEqual([
      { variant_id: "variant_ab_c", cost_amount: 10 },
    ])
  })

  it("matches option values whatever order the API lists them in", () => {
    const options = [option("1", "Size", "S"), option("2", "Color", "Red")]
    const requests = buildFollowUpRequests(
      form({
        options,
        variants: { [keyOf(options, "S / Red")]: row({ cost_amount: "3" }) },
      }),
      ctx(),
      [createdVariant("variant_1", { Color: "Red", Size: "S" })]
    )

    expect(requests.pricing).toEqual([
      { variant_id: "variant_1", cost_amount: 3 },
    ])
  })

  it("reports a variant the API returned without its options", () => {
    const requests = buildFollowUpRequests(
      form({
        variants: { [DEFAULT_VARIANT_KEY]: row({ cost_amount: "3" }) },
      }),
      ctx(),
      [{ id: "variant_1", options: null }]
    )

    expect(requests.pricing).toEqual([])
    expect(requests.unmatched_variants).toEqual([DEFAULT_VARIANT_TITLE])
  })

  it("skips variants with neither compare-at nor cost", () => {
    const requests = buildFollowUpRequests(
      form({
        options: sizes,
        variants: {
          [keyOf(sizes, "S")]: row({ price: "10", sku: "TEE-S" }),
          [keyOf(sizes, "M")]: row({ cost_amount: "0" }),
        },
      }),
      ctx(),
      created
    )

    expect(requests.pricing).toEqual([
      { variant_id: "variant_m", cost_amount: 0 },
    ])
  })

  it("reports a variant with a compare-at that the created product doesn't have", () => {
    const requests = buildFollowUpRequests(
      form({
        options: sizes,
        variants: {
          [keyOf(sizes, "S")]: row({ compare_at_amount: "80" }),
          [keyOf(sizes, "M")]: row({ compare_at_amount: "90" }),
        },
      }),
      ctx(),
      [created[0]]
    )

    expect(requests.pricing).toEqual([
      { variant_id: "variant_s", compare_at_amount: 80 },
    ])
    expect(requests.unmatched_variants).toEqual(["M"])
    expect(followUpParts(requests)).toEqual(["pricing"])
  })

  it("sends the default variant's compare-at for a product without options", () => {
    const requests = buildFollowUpRequests(
      form({
        variants: { [DEFAULT_VARIANT_KEY]: row({ compare_at_amount: "30" }) },
      }),
      ctx(),
      [DEFAULT_CREATED]
    )

    expect(requests.pricing).toEqual([
      { variant_id: "variant_1", compare_at_amount: 30 },
    ])
  })

  it("sends filled metafields with their definition's type, skipping empty ones", () => {
    const requests = buildFollowUpRequests(
      form({
        metafields: {
          weight_grams: "250",
          washable: "true",
          care: "",
          fit: "Slim",
        },
      }),
      ctx({
        metafield_definitions: [
          {
            key: "weight_grams",
            label: "Weight (g)",
            type: "number",
            options: null,
          },
          {
            key: "washable",
            label: "Washable",
            type: "boolean",
            options: null,
          },
          { key: "care", label: "Care", type: "text", options: null },
          {
            key: "fit",
            label: "Fit",
            type: "select",
            options: ["Slim", "Regular"],
          },
        ],
      }),
      []
    )

    expect(requests.metafields).toEqual(
      expect.arrayContaining([
        { key: "weight_grams", value: 250 },
        { key: "washable", value: true },
        { key: "fit", value: "Slim" },
      ])
    )
    expect(requests.metafields).toHaveLength(3)
  })

  it("ignores inputs for keys that have no definition", () => {
    const requests = buildFollowUpRequests(
      form({ metafields: { gone: "value" } }),
      ctx(),
      []
    )

    expect(requests.metafields).toBeNull()
  })

  it("sends trimmed SEO fields and leaves blank ones to their fallbacks", () => {
    expect(
      buildFollowUpRequests(
        form({ seo: { title: " Best tee ", description: "   " } }),
        ctx(),
        []
      ).seo
    ).toEqual({ title: "Best tee" })

    expect(
      buildFollowUpRequests(
        form({ seo: { title: " ", description: "" } }),
        ctx(),
        []
      ).seo
    ).toBeNull()
  })

  it("sends the picked package, and nothing for the store default", () => {
    const shipping = emptyAddProductForm().shipping

    expect(
      buildFollowUpRequests(
        form({ shipping: { ...shipping, package_preset_id: "pkg_1" } }),
        ctx(),
        []
      ).package
    ).toBe("pkg_1")
    expect(buildFollowUpRequests(form(), ctx(), []).package).toBeNull()
  })

  it("lists the parts to save in page order", () => {
    const requests = buildFollowUpRequests(
      form({
        variants: { [DEFAULT_VARIANT_KEY]: row({ cost_amount: "5" }) },
        metafields: { care: "Hand wash" },
        seo: { title: "Tee", description: "" },
        shipping: {
          ...emptyAddProductForm().shipping,
          package_preset_id: "pkg_1",
        },
      }),
      ctx({
        metafield_definitions: [
          { key: "care", label: "Care", type: "text", options: null },
        ],
      }),
      [DEFAULT_CREATED]
    )

    expect(followUpParts(requests)).toEqual([
      "pricing",
      "metafields",
      "seo",
      "package",
    ])
  })
})

describe("media helpers", () => {
  it("adds media at the end, skipping ones already picked", () => {
    expect(addMedia(["media_1", "media_2"], ["media_2", "media_3"])).toEqual([
      "media_1",
      "media_2",
      "media_3",
    ])
  })

  it("removes a media item and keeps the picked thumbnail", () => {
    expect(
      removeMedia(
        { media_ids: ["media_1", "media_2"], thumbnail_id: "media_2" },
        "media_1"
      )
    ).toEqual({ media_ids: ["media_2"], thumbnail_id: "media_2" })
  })

  it("unpicks the thumbnail when it is removed, so the first item takes over", () => {
    const next = removeMedia(
      { media_ids: ["media_1", "media_2", "media_3"], thumbnail_id: "media_2" },
      "media_2"
    )

    expect(next).toEqual({
      media_ids: ["media_1", "media_3"],
      thumbnail_id: null,
    })
    expect(effectiveThumbnailId(next)).toBe("media_1")
  })

  it("uses the picked thumbnail, else the first item, else none", () => {
    expect(
      effectiveThumbnailId({ media_ids: ["a", "b"], thumbnail_id: "b" })
    ).toBe("b")
    expect(
      effectiveThumbnailId({ media_ids: ["a", "b"], thumbnail_id: null })
    ).toBe("a")
    expect(
      effectiveThumbnailId({ media_ids: ["a"], thumbnail_id: "gone" })
    ).toBe("a")
    expect(
      effectiveThumbnailId({ media_ids: [], thumbnail_id: null })
    ).toBeNull()
  })
})

describe("emptyAddProductForm", () => {
  it("starts as a tracked draft in the given sales channels", () => {
    const empty = emptyAddProductForm({ sales_channel_ids: ["sc_default"] })

    expect(empty).toMatchObject({
      status: "draft",
      track_inventory: true,
      sales_channel_ids: ["sc_default"],
      options: [],
      media_ids: [],
    })
  })
})
