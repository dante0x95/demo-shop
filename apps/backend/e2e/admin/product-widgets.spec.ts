import { APIRequestContext, expect, Locator, Page, test } from "@playwright/test"

type Variant = { id: string; title: string }
type Product = { id: string; title: string; variants: Variant[] }
type Preset = { id: string; name: string }

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const AMOUNT_ERROR = "Enter an amount of 0 or more, like 49.99"
const NOT_HIGHER =
  "Not shown in the storefront: it must be higher than the price"

// Prices are created in the store's default currency, which every amount the
// widget shows is in.
const defaultCurrency = async (request: APIRequestContext) => {
  const res = await request.get("/admin/stores", {
    params: { fields: "id,*supported_currencies" },
  })
  expect(res.status()).toBe(200)
  const [store] = (await res.json()).stores
  const currency = store.supported_currencies.find(
    (item: { is_default: boolean }) => item.is_default
  )
  expect(currency).toBeTruthy()
  return currency.currency_code as string
}

// A product with variants "S" (price 50) and "M" (price 20).
const createProductViaApi = async (
  request: APIRequestContext,
  data: Record<string, unknown> = {}
): Promise<Product> => {
  const currency_code = await defaultCurrency(request)
  const id = suffix()
  const res = await request.post("/admin/products", {
    data: {
      title: `Shirt ${id}`,
      options: [{ title: "Size", values: ["S", "M"] }],
      variants: [
        {
          title: "S",
          sku: `SHIRT-S-${id}`,
          options: { Size: "S" },
          prices: [{ currency_code, amount: 50 }],
        },
        {
          title: "M",
          sku: `SHIRT-M-${id}`,
          options: { Size: "M" },
          prices: [{ currency_code, amount: 20 }],
        },
      ],
      ...data,
    },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).product
}

const variantId = (product: Product, title: string) => {
  const variant = product.variants.find((item) => item.title === title)
  expect(variant).toBeTruthy()
  return variant!.id
}

const getVariantPricing = async (request: APIRequestContext, productId: string) => {
  const res = await request.get(`/admin/products/${productId}/variant-pricing`)
  expect(res.status()).toBe(200)
  return (await res.json()).variant_pricing
}

const getSeo = async (request: APIRequestContext, productId: string) => {
  const res = await request.get(`/admin/products/${productId}/seo`)
  expect(res.status()).toBe(200)
  return (await res.json()).product_seo
}

const getProductPackage = async (
  request: APIRequestContext,
  productId: string
) => {
  const res = await request.get(`/admin/products/${productId}/package-preset`)
  expect(res.status()).toBe(200)
  return (await res.json()).product_package_preset
}

const createPresetViaApi = async (
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<Preset> => {
  const res = await request.post("/admin/package-presets", {
    data: {
      length: 30,
      width: 20,
      height: 10.5,
      dimension_unit: "cm",
      weight: 0.25,
      weight_unit: "kg",
      ...data,
    },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).package_preset
}

const deleteAllPresetsViaApi = async (request: APIRequestContext) => {
  for (;;) {
    const res = await request.get("/admin/package-presets", {
      params: { limit: 100 },
    })
    expect(res.status()).toBe(200)
    const { package_presets } = await res.json()

    if (!package_presets.length) {
      return
    }

    for (const preset of package_presets as Preset[]) {
      const deleted = await request.delete(`/admin/package-presets/${preset.id}`)
      expect(deleted.status()).toBe(200)
    }
  }
}

const openProduct = async (page: Page, productId: string) => {
  await page.goto(`/app/products/${productId}`)
}

const pricingWidget = (page: Page) =>
  page.getByTestId("product-variant-pricing-widget")
const seoWidget = (page: Page) => page.getByTestId("product-seo-widget")
const packageWidget = (page: Page) => page.getByTestId("product-package-widget")

const openDrawer = async (widget: Locator, page: Page, title: string) => {
  await widget.getByRole("button", { name: "Edit" }).click()
  const drawer = page.getByRole("dialog")
  await expect(drawer.getByRole("heading", { name: title })).toBeVisible()
  return drawer
}

// The product page has its own variants table, so rows are looked up inside
// the widget, by the variant's SKU.
const pricingRow = (page: Page, size: "S" | "M") =>
  pricingWidget(page).getByRole("row").filter({ hasText: `SHIRT-${size}-` })

const variantGroup = (drawer: Locator, title: string) =>
  drawer.getByRole("group", { name: title, exact: true })

test.describe("Product page: compare-at price and cost widget", () => {
  test("lists each variant's price with no compare-at or cost yet", async ({
    page,
  }) => {
    const product = await createProductViaApi(page.request)
    await openProduct(page, product.id)

    const widget = pricingWidget(page)
    await expect(widget.getByRole("heading", { name: "Compare-at price and cost" })).toBeVisible()
    for (const header of ["Variant", "Price", "Compare-at price", "Cost per item"]) {
      await expect(widget.getByRole("columnheader", { name: header })).toBeVisible()
    }

    const row = pricingRow(page, "S")
    await expect(row).toContainText("50.00")
    await expect(row.getByRole("cell").nth(2)).toHaveText("-")
    await expect(row.getByRole("cell").nth(3)).toHaveText("-")
  })

  test("saves compare-at and cost per variant, sending only what changed", async ({
    page,
  }) => {
    const product = await createProductViaApi(page.request)
    await openProduct(page, product.id)

    const drawer = await openDrawer(
      pricingWidget(page),
      page,
      "Edit compare-at prices and costs"
    )
    const s = variantGroup(drawer, "S")
    const m = variantGroup(drawer, "M")
    await s.getByLabel("Compare-at price").fill("80")
    await s.getByLabel("Cost per item").fill("20.5")
    // Lower than M's price (20): saved, but the storefront won't show it.
    await m.getByLabel("Compare-at price").fill("15")
    await expect(m).toContainText(NOT_HIGHER)

    const saved = page.waitForRequest(
      (req) =>
        req.url().endsWith(`/admin/products/${product.id}/variant-pricing`) &&
        req.method() === "POST"
    )
    await drawer.getByRole("button", { name: "Save" }).click()
    expect((await saved).postDataJSON()).toEqual({
      variants: [
        {
          variant_id: variantId(product, "S"),
          compare_at_amount: 80,
          cost_amount: 20.5,
        },
        { variant_id: variantId(product, "M"), compare_at_amount: 15 },
      ],
    })

    await expect(page.getByText("Compare-at prices and costs updated")).toBeVisible()
    await expect(drawer).toBeHidden()

    const sRow = pricingRow(page, "S")
    await expect(sRow.getByRole("cell").nth(2)).toContainText("80.00")
    await expect(sRow.getByRole("cell").nth(3)).toContainText("20.50")
    const mRow = pricingRow(page, "M")
    await expect(mRow.getByRole("cell").nth(2)).toContainText("15.00")
    await expect(mRow).toContainText(NOT_HIGHER)

    const pricing = await getVariantPricing(page.request, product.id)
    expect(pricing.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variant_id: variantId(product, "S"),
          compare_at_amount: 80,
          cost_amount: 20.5,
        }),
        expect.objectContaining({
          variant_id: variantId(product, "M"),
          compare_at_amount: 15,
          cost_amount: null,
        }),
      ])
    )
  })

  test("clears a value when its field is emptied", async ({ page }) => {
    const product = await createProductViaApi(page.request)
    const res = await page.request.post(
      `/admin/products/${product.id}/variant-pricing`,
      {
        data: {
          variants: [
            {
              variant_id: variantId(product, "S"),
              compare_at_amount: 80,
              cost_amount: 30,
            },
          ],
        },
      }
    )
    expect(res.status()).toBe(200)

    await openProduct(page, product.id)
    const drawer = await openDrawer(
      pricingWidget(page),
      page,
      "Edit compare-at prices and costs"
    )
    const s = variantGroup(drawer, "S")
    await expect(s.getByLabel("Compare-at price")).toHaveValue("80")
    await s.getByLabel("Compare-at price").fill("")
    await drawer.getByRole("button", { name: "Save" }).click()
    await expect(drawer).toBeHidden()

    const sRow = pricingRow(page, "S")
    await expect(sRow.getByRole("cell").nth(2)).toHaveText("-")
    await expect(sRow.getByRole("cell").nth(3)).toContainText("30.00")

    const pricing = await getVariantPricing(page.request, product.id)
    expect(
      pricing.variants.find(
        (item: { variant_id: string }) =>
          item.variant_id === variantId(product, "S")
      )
    ).toMatchObject({ compare_at_amount: null, cost_amount: 30 })
  })

  test("flags an invalid amount and sends nothing", async ({ page }) => {
    const product = await createProductViaApi(page.request)
    await openProduct(page, product.id)

    let posted = false
    page.on("request", (req) => {
      if (req.url().includes("/variant-pricing") && req.method() === "POST") {
        posted = true
      }
    })

    const drawer = await openDrawer(
      pricingWidget(page),
      page,
      "Edit compare-at prices and costs"
    )
    const s = variantGroup(drawer, "S")
    await s.getByLabel("Cost per item").fill("-5")
    await drawer.getByRole("button", { name: "Save" }).click()

    await expect(s.getByText(AMOUNT_ERROR)).toBeVisible()
    await expect(drawer).toBeVisible()
    expect(posted).toBe(false)
  })

  test("shows the API error when saving fails", async ({ page }) => {
    const product = await createProductViaApi(page.request)
    const message = "Variant pricing is unavailable"
    await page.route(
      `**/admin/products/${product.id}/variant-pricing`,
      (route) =>
        route.request().method() === "POST"
          ? route.fulfill({
              status: 400,
              json: { type: "invalid_data", message },
            })
          : route.continue()
    )
    await openProduct(page, product.id)

    const drawer = await openDrawer(
      pricingWidget(page),
      page,
      "Edit compare-at prices and costs"
    )
    await variantGroup(drawer, "S").getByLabel("Compare-at price").fill("99")
    await drawer.getByRole("button", { name: "Save" }).click()

    await expect(drawer.getByRole("alert")).toContainText(message)
    await expect(drawer).toBeVisible()
  })
})

test.describe("Product page: SEO widget", () => {
  test("shows the product's title and description as fallbacks", async ({
    page,
  }) => {
    const product = await createProductViaApi(page.request, {
      description: "Soft cotton\nshirt",
    })
    await openProduct(page, product.id)

    const widget = seoWidget(page)
    await expect(widget).toContainText(product.title)
    await expect(widget).toContainText("Soft cotton shirt")
    await expect(widget.getByText("From product title")).toBeVisible()
    await expect(widget.getByText("From product description")).toBeVisible()

    const drawer = await openDrawer(widget, page, "Edit SEO")
    await expect(drawer.getByLabel("Page title")).toHaveValue("")
    await expect(drawer.getByLabel("Page title")).toHaveAttribute(
      "placeholder",
      product.title
    )
    await expect(drawer.getByLabel("Meta description")).toHaveAttribute(
      "placeholder",
      "Soft cotton shirt"
    )
    await expect(drawer.getByText("0 of 70 characters used")).toBeVisible()
    await expect(drawer.getByText("0 of 160 characters used")).toBeVisible()
  })

  test("saves an SEO title and meta description with live counters", async ({
    page,
  }) => {
    const product = await createProductViaApi(page.request)
    await openProduct(page, product.id)

    const drawer = await openDrawer(seoWidget(page), page, "Edit SEO")
    await drawer.getByLabel("Page title").fill("Buy the best shirt")
    await expect(drawer.getByText("18 of 70 characters used")).toBeVisible()
    await drawer.getByLabel("Meta description").fill("A shirt for every day.")
    await expect(drawer.getByText("22 of 160 characters used")).toBeVisible()
    await drawer.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("SEO updated")).toBeVisible()
    await expect(drawer).toBeHidden()
    const widget = seoWidget(page)
    await expect(widget).toContainText("Buy the best shirt")
    await expect(widget).toContainText("A shirt for every day.")
    await expect(widget.getByText("From product title")).toHaveCount(0)

    expect(await getSeo(page.request, product.id)).toMatchObject({
      title: "Buy the best shirt",
      description: "A shirt for every day.",
    })
  })

  test("saves a title longer than the 70-character guide", async ({ page }) => {
    const product = await createProductViaApi(page.request)
    const title = "t".repeat(71)
    await openProduct(page, product.id)

    const drawer = await openDrawer(seoWidget(page), page, "Edit SEO")
    await drawer.getByLabel("Page title").fill(title)
    await expect(drawer.getByText("71 of 70 characters used")).toBeVisible()
    await drawer.getByRole("button", { name: "Save" }).click()
    await expect(drawer).toBeHidden()

    expect((await getSeo(page.request, product.id)).title).toBe(title)
  })

  test("goes back to the product title when the SEO title is cleared", async ({
    page,
  }) => {
    const product = await createProductViaApi(page.request)
    const res = await page.request.post(`/admin/products/${product.id}/seo`, {
      data: { title: "Custom title", description: "Custom description" },
    })
    expect(res.status()).toBe(200)
    await openProduct(page, product.id)

    const widget = seoWidget(page)
    await expect(widget).toContainText("Custom title")
    const drawer = await openDrawer(widget, page, "Edit SEO")
    await drawer.getByLabel("Page title").fill("   ")
    await drawer.getByRole("button", { name: "Save" }).click()
    await expect(drawer).toBeHidden()

    await expect(widget).toContainText(product.title)
    await expect(widget.getByText("From product title")).toBeVisible()
    // The description was not touched, so it is kept.
    expect(await getSeo(page.request, product.id)).toMatchObject({
      title: null,
      description: "Custom description",
    })
  })
})

test.describe("Product page: package widget", () => {
  test("shows the store's default package when the product has none", async ({
    page,
  }) => {
    const storeDefault = await createPresetViaApi(page.request, {
      name: `Default box ${suffix()}`,
      is_default: true,
    })
    const product = await createProductViaApi(page.request)
    await openProduct(page, product.id)

    const widget = packageWidget(page)
    await expect(widget).toContainText(storeDefault.name)
    await expect(widget.getByText("Store default")).toBeVisible()
    await expect(widget).toContainText("30 × 20 × 10.5 cm")
    await expect(widget).toContainText("0.25 kg")
  })

  test("picks a package for the product", async ({ page }) => {
    await createPresetViaApi(page.request, {
      name: `Default box ${suffix()}`,
      is_default: true,
    })
    const preset = await createPresetViaApi(page.request, {
      name: `Tube ${suffix()}`,
      length: 60,
      width: 8,
      height: 8,
      weight: 120,
      weight_unit: "g",
    })
    const product = await createProductViaApi(page.request)
    await openProduct(page, product.id)

    const drawer = await openDrawer(packageWidget(page), page, "Edit package")
    await drawer.getByRole("combobox", { name: "Package" }).click()
    await page
      .getByRole("option", { name: `${preset.name} (60 × 8 × 8 cm, 120 g)` })
      .click()
    await drawer.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("Package updated")).toBeVisible()
    await expect(drawer).toBeHidden()
    const widget = packageWidget(page)
    await expect(widget).toContainText(preset.name)
    await expect(widget).toContainText("60 × 8 × 8 cm")
    await expect(widget.getByText("Store default")).toHaveCount(0)

    const view = await getProductPackage(page.request, product.id)
    expect(view.package_preset.id).toBe(preset.id)
  })

  test("goes back to the store default", async ({ page }) => {
    const storeDefault = await createPresetViaApi(page.request, {
      name: `Default box ${suffix()}`,
      is_default: true,
    })
    const preset = await createPresetViaApi(page.request, {
      name: `Envelope ${suffix()}`,
    })
    const product = await createProductViaApi(page.request)
    const res = await page.request.post(
      `/admin/products/${product.id}/package-preset`,
      { data: { package_preset_id: preset.id } }
    )
    expect(res.status()).toBe(200)
    await openProduct(page, product.id)

    const widget = packageWidget(page)
    await expect(widget).toContainText(preset.name)
    const drawer = await openDrawer(widget, page, "Edit package")
    await drawer.getByRole("combobox", { name: "Package" }).click()
    await page
      .getByRole("option", { name: `Store default (${storeDefault.name})` })
      .click()
    await drawer.getByRole("button", { name: "Save" }).click()
    await expect(drawer).toBeHidden()

    await expect(widget).toContainText(storeDefault.name)
    await expect(widget.getByText("Store default")).toBeVisible()
    const view = await getProductPackage(page.request, product.id)
    expect(view.package_preset).toBeNull()
    expect(view.resolved.id).toBe(storeDefault.id)
  })

  test("says there is no package when the store has no default", async ({
    page,
  }) => {
    await deleteAllPresetsViaApi(page.request)
    const product = await createProductViaApi(page.request)
    await openProduct(page, product.id)

    const widget = packageWidget(page)
    await expect(widget).toContainText("No package")
    await expect(widget).toContainText("The store has no default package.")

    const drawer = await openDrawer(widget, page, "Edit package")
    await expect(drawer.getByRole("combobox", { name: "Package" })).toContainText(
      "Store default (none set)"
    )
  })
})
