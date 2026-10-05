import {
  APIRequestContext,
  expect,
  Locator,
  Page,
  test,
} from "@playwright/test"
import { createDefinitionViaApi, uniqueKey } from "../fixtures/metafields"

// Smallest valid PNG: the upload API checks each file's signature.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)

const AMOUNT_ERROR = "Enter an amount of 0 or more, like 49.99"

const unique = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const png = (name: string) => ({
  name: `${name}.png`,
  mimeType: "image/png",
  buffer: PNG,
})

const postOk = async (
  request: APIRequestContext,
  url: string,
  data: Record<string, unknown>
) => {
  const res = await request.post(url, { data })
  expect(res.status(), `POST ${url}`).toBe(200)
  return res.json()
}

const uploadViaApi = async (request: APIRequestContext, name: string) => {
  const res = await request.post("/admin/media", {
    multipart: { files: png(name) },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).media_assets[0] as {
    id: string
    url: string
    filename: string
  }
}

const defaultCurrency = async (request: APIRequestContext) => {
  const res = await request.get("/admin/stores", {
    params: { fields: "id,*supported_currencies" },
  })
  expect(res.status()).toBe(200)
  const [store] = (await res.json()).stores
  return store.supported_currencies.find(
    (item: { is_default: boolean }) => item.is_default
  ).currency_code as string
}

const PRODUCT_FIELDS = [
  "id",
  "title",
  "description",
  "handle",
  "status",
  "thumbnail",
  "weight",
  "length",
  "width",
  "height",
  "origin_country",
  "hs_code",
  "*images",
  "*options",
  "*options.values",
  "*variants",
  "*variants.prices",
  "*variants.options",
  "variants.inventory_items.inventory.location_levels.location_id",
  "variants.inventory_items.inventory.location_levels.stocked_quantity",
  "*categories",
  "*tags",
  "*type",
  "*collection",
  "*sales_channels",
  "brand.id",
].join(",")

const getProduct = async (request: APIRequestContext, id: string) => {
  const res = await request.get(`/admin/products/${id}`, {
    params: { fields: PRODUCT_FIELDS },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).product
}

const productsTitled = async (request: APIRequestContext, title: string) => {
  const res = await request.get("/admin/products", {
    params: { q: title, fields: "id,title" },
  })
  expect(res.status()).toBe(200)
  return (
    (await res.json()).products as { id: string; title: string }[]
  ).filter((product) => product.title === title)
}

const getJson = async (request: APIRequestContext, url: string) => {
  const res = await request.get(url)
  expect(res.status(), `GET ${url}`).toBe(200)
  return res.json()
}

const openPage = async (page: Page) => {
  await page.goto("/app/products/add")
  await expect(page.getByRole("heading", { name: "Add product" })).toBeVisible()
}

const section = (page: Page, name: string) => page.getByRole("region", { name })

const variantGroup = (page: Page, title: string) =>
  section(page, "Variants").getByRole("group", { name: title, exact: true })

// A picker from Medusa's dashboard: type to filter, then click the option.
const pick = async (page: Page, input: Locator, label: string) => {
  await input.click()
  await input.fill(label)
  await page.getByRole("option", { name: label, exact: true }).click()
  await input.press("Escape")
}

const save = (page: Page) =>
  page.getByRole("button", { name: "Save", exact: true })

const waitForProductPage = async (page: Page) => {
  await expect(page).toHaveURL(/\/app\/products\/prod_[A-Z0-9]+$/)
  return page.url().split("/").pop()!
}

test.describe("Add product page", () => {
  test("is linked from the Products menu", async ({ page }) => {
    await page.goto("/app/products")
    await page.getByRole("link", { name: "Add product" }).click()

    await expect(page).toHaveURL(/\/app\/products\/add$/)
    await expect(
      page.getByRole("heading", { name: "Add product" })
    ).toBeVisible()
  })

  test("creates a product with variants and every part in one save", async ({
    page,
  }) => {
    const request = page.request
    const id = unique("full")
    const currency = await defaultCurrency(request)
    const [
      { stock_location: location },
      { product_category: category },
      { product_type: type },
      { collection },
      { product_tag: tag },
      { brand },
      { package_preset: preset },
    ] = await Promise.all([
      postOk(request, "/admin/stock-locations", { name: `Warehouse ${id}` }),
      postOk(request, "/admin/product-categories", { name: `Shirts ${id}` }),
      postOk(request, "/admin/product-types", { value: `Apparel ${id}` }),
      postOk(request, "/admin/collections", { title: `Summer ${id}` }),
      postOk(request, "/admin/product-tags", { value: `cotton-${id}` }),
      postOk(request, "/admin/brands", { name: `Brand ${id}` }),
      postOk(request, "/admin/package-presets", {
        name: `Box ${id}`,
        length: 30,
        width: 20,
        height: 10,
        dimension_unit: "cm",
        weight: 0.2,
        weight_unit: "kg",
      }),
    ])
    const definition = await createDefinitionViaApi(request, {
      key: uniqueKey("weight_grams"),
      label: `Weight in grams ${id}`,
      type: "number",
    })
    const libraryAsset = await uploadViaApi(request, unique("library"))
    const uploadName = `${unique("uploaded")}`

    await openPage(page)

    // General
    const title = `Tee ${id}`
    await page.getByLabel("Title", { exact: true }).fill(title)
    await section(page, "General")
      .getByLabel("Description")
      .fill("Soft cotton tee")

    // Media: one from the library, one uploaded here and used as thumbnail.
    const media = section(page, "Media")
    await media.getByRole("button", { name: "Choose from library" }).click()
    const picker = page.getByRole("dialog")
    await picker
      .getByPlaceholder("Search filename or alt text")
      .fill(libraryAsset.filename)
    const assetRow = picker
      .getByRole("row")
      .filter({ hasText: libraryAsset.filename })
    await assetRow.getByRole("checkbox").click()
    await picker.getByRole("button", { name: "Add 1 selected" }).click()
    await expect(picker).toBeHidden()
    await expect(
      media.getByRole("listitem", { name: libraryAsset.filename })
    ).toBeVisible()

    const uploaded = page.waitForResponse(
      (res) =>
        res.url().endsWith("/admin/media") && res.request().method() === "POST"
    )
    await media
      .getByLabel("Upload media files")
      .setInputFiles([png(uploadName)])
    const uploadedAsset = (await (await uploaded).json()).media_assets[0]
    const uploadedItem = media.getByRole("listitem", {
      name: `${uploadName}.png`,
    })
    await expect(uploadedItem).toBeVisible()
    await expect(
      media
        .getByRole("listitem", { name: libraryAsset.filename })
        .getByText("Thumbnail")
    ).toBeVisible()
    await uploadedItem
      .getByRole("button", { name: `Use ${uploadName}.png as thumbnail` })
      .click()
    await expect(uploadedItem.getByText("Thumbnail")).toBeVisible()

    // Variants
    await section(page, "Variants")
      .getByRole("button", { name: "Add option" })
      .click()
    await page.getByLabel("Option name").fill("Size")
    await page.getByLabel("Option values").fill("S, M")
    await expect(section(page, "Pricing")).toHaveCount(0)

    const s = variantGroup(page, "S")
    await s.getByLabel("Price", { exact: true }).fill("50")
    await s.getByLabel("Compare-at price").fill("80")
    await s.getByLabel("Cost per item").fill("20.5")
    await s.getByLabel("SKU").fill(`TEE-S-${id}`)
    await s.getByLabel("Barcode").fill("0001")
    await s.getByLabel(`Warehouse ${id}`).fill("7")

    const m = variantGroup(page, "M")
    await m.getByLabel("Price", { exact: true }).fill("20")
    await m.getByLabel("SKU").fill(`TEE-M-${id}`)
    // Lower than the price: saved, but the storefront won't show it.
    await m.getByLabel("Compare-at price").fill("15")
    await expect(m).toContainText(
      "Not shown in the storefront: it must be higher than the price"
    )

    // Shipping
    const shipping = section(page, "Shipping")
    await shipping.getByLabel("Package").click()
    await page.getByRole("option", { name: new RegExp(`^Box ${id} `) }).click()
    await shipping.getByLabel("Weight").fill("0.5")
    await shipping.getByLabel("Length").fill("30")
    await shipping.getByLabel("Width").fill("20")
    await shipping.getByLabel("Height").fill("2")
    await pick(page, shipping.getByLabel("Country of origin"), "Argentina")
    await shipping.getByLabel("HS code").fill("6109.10")

    // Metafields and SEO
    await section(page, "Metafields").getByLabel(definition.label).fill("250")
    const seo = section(page, "Search engine listing")
    await seo.getByLabel("Page title").fill("Best tee")
    await seo.getByLabel("Meta description").fill("The softest tee")
    await seo.getByLabel("URL handle").fill(`tee-${id}`)

    // Side column
    await section(page, "Status").getByLabel("Status").click()
    await page.getByRole("option", { name: "Published" }).click()
    // New products start in the store's default sales channel.
    await expect(section(page, "Publishing")).toContainText(
      "Default Sales Channel"
    )
    const organization = section(page, "Organization")
    await pick(page, organization.getByLabel("Categories"), category.name)
    await pick(page, organization.getByLabel("Type"), type.value)
    await pick(page, organization.getByLabel("Vendor (brand)"), brand.name)
    await pick(page, organization.getByLabel("Collection"), collection.title)
    await pick(page, organization.getByLabel("Tags"), tag.value)

    const created = page.waitForRequest(
      (req) =>
        req.url().includes("/admin/products/full") && req.method() === "POST"
    )
    await save(page).click()
    const body = (await created).postDataJSON()
    // Compare-at and cost go to their own endpoint once the product exists.
    expect(JSON.stringify(body)).not.toContain("compare_at")

    const productId = await waitForProductPage(page)
    const product = await getProduct(request, productId)

    expect(product).toMatchObject({
      title,
      description: "Soft cotton tee",
      handle: `tee-${id}`,
      status: "published",
      thumbnail: uploadedAsset.url,
      weight: 0.5,
      length: 30,
      width: 20,
      height: 2,
      origin_country: "ar",
      hs_code: "6109.10",
      type: { id: type.id },
      collection: { id: collection.id },
      brand: { id: brand.id },
    })
    expect(product.images.map((image: { url: string }) => image.url)).toEqual([
      libraryAsset.url,
      uploadedAsset.url,
    ])
    expect(product.categories.map((item: { id: string }) => item.id)).toEqual([
      category.id,
    ])
    expect(product.tags.map((item: { id: string }) => item.id)).toEqual([
      tag.id,
    ])
    expect(
      product.sales_channels.map((item: { name: string }) => item.name)
    ).toEqual(["Default Sales Channel"])
    expect(product.options).toEqual([
      expect.objectContaining({
        title: "Size",
        values: expect.arrayContaining([
          expect.objectContaining({ value: "S" }),
          expect.objectContaining({ value: "M" }),
        ]),
      }),
    ])

    const variantS = product.variants.find(
      (v: { title: string }) => v.title === "S"
    )
    const variantM = product.variants.find(
      (v: { title: string }) => v.title === "M"
    )
    expect(variantS).toMatchObject({
      sku: `TEE-S-${id}`,
      barcode: "0001",
      manage_inventory: true,
    })
    expect(variantS.prices).toEqual([
      expect.objectContaining({ amount: 50, currency_code: currency }),
    ])
    expect(variantM.prices).toEqual([
      expect.objectContaining({ amount: 20, currency_code: currency }),
    ])
    expect(variantS.inventory_items[0].inventory.location_levels).toEqual([
      { location_id: location.id, stocked_quantity: 7 },
    ])
    expect(variantM.inventory_items[0].inventory.location_levels).toEqual([])

    const { variant_pricing } = await getJson(
      request,
      `/admin/products/${productId}/variant-pricing`
    )
    expect(variant_pricing.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variant_id: variantS.id,
          compare_at_amount: 80,
          cost_amount: 20.5,
        }),
        expect.objectContaining({
          variant_id: variantM.id,
          compare_at_amount: 15,
          cost_amount: null,
        }),
      ])
    )

    const { metafields } = await getJson(
      request,
      `/admin/products/${productId}/metafields`
    )
    expect(metafields).toEqual([
      expect.objectContaining({
        key: definition.key,
        type: "number",
        value: 250,
      }),
    ])

    const { product_seo } = await getJson(
      request,
      `/admin/products/${productId}/seo`
    )
    expect(product_seo).toMatchObject({
      title: "Best tee",
      description: "The softest tee",
    })

    const { product_package_preset } = await getJson(
      request,
      `/admin/products/${productId}/package-preset`
    )
    expect(product_package_preset.package_preset.id).toBe(preset.id)
  })

  test("creates a single-variant product from the pricing and inventory cards", async ({
    page,
  }) => {
    const request = page.request
    const id = unique("simple")
    const { stock_location: location } = await postOk(
      request,
      "/admin/stock-locations",
      {
        name: `Shelf ${id}`,
      }
    )
    const followUps: string[] = []
    page.on("request", (req) => {
      if (
        req.method() === "POST" &&
        /\/admin\/products\/prod_/.test(req.url())
      ) {
        followUps.push(req.url())
      }
    })

    await openPage(page)
    await page.getByLabel("Title", { exact: true }).fill(`Mug ${id}`)
    const pricing = section(page, "Pricing")
    await pricing.getByLabel("Price", { exact: true }).fill("12.5")
    const inventory = section(page, "Inventory")
    await expect(inventory.getByLabel("Track quantity")).toBeChecked()
    await inventory.getByLabel("SKU").fill(`MUG-${id}`)
    await inventory.getByLabel(`Shelf ${id}`).fill("3")

    await save(page).click()
    const productId = await waitForProductPage(page)
    const product = await getProduct(request, productId)

    expect(product.status).toBe("draft")
    expect(
      product.options.map((option: { title: string }) => option.title)
    ).toEqual(["Default option"])
    expect(product.variants).toHaveLength(1)
    expect(product.variants[0]).toMatchObject({
      title: "Default variant",
      sku: `MUG-${id}`,
    })
    expect(product.variants[0].prices).toEqual([
      expect.objectContaining({ amount: 12.5 }),
    ])
    expect(
      product.variants[0].inventory_items[0].inventory.location_levels
    ).toEqual([{ location_id: location.id, stocked_quantity: 3 }])
    // Nothing else to save: no request after the product was created.
    expect(followUps).toEqual([])
  })

  test("doesn't track inventory when the admin turns it off", async ({
    page,
  }) => {
    const id = unique("untracked")

    await openPage(page)
    await page.getByLabel("Title", { exact: true }).fill(`Gift wrap ${id}`)
    const inventory = section(page, "Inventory")
    await inventory.getByLabel("Track quantity").click()
    await expect(inventory.getByText("Quantity per location")).toHaveCount(0)

    await save(page).click()
    const productId = await waitForProductPage(page)
    const product = await getProduct(page.request, productId)

    expect(product.variants[0].manage_inventory).toBe(false)
  })

  test("points at invalid fields and sends nothing", async ({ page }) => {
    let requests = 0
    page.on("request", (req) => {
      if (req.url().includes("/admin/products/full")) {
        requests++
      }
    })

    await openPage(page)
    await section(page, "Pricing").getByLabel("Compare-at price").fill("abc")
    await section(page, "Variants")
      .getByRole("button", { name: "Add option" })
      .click()
    await page.getByLabel("Option values").fill("S, M")
    await save(page).click()

    await expect(
      page.getByRole("alert").filter({ hasText: "Some fields need attention" })
    ).toBeVisible()
    await expect(section(page, "General")).toContainText("Enter a title")
    await expect(section(page, "Variants")).toContainText("Name the option")
    await expect(page.getByLabel("Title", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true"
    )

    // Fixing the option shows its variants; the default variant's inputs are
    // no longer what gets saved.
    await page.getByLabel("Option name").fill("Size")
    await variantGroup(page, "S").getByLabel("Cost per item").fill("-1")
    await page.getByLabel("Title", { exact: true }).fill("Invalid cost")
    await save(page).click()
    await expect(variantGroup(page, "S")).toContainText(AMOUNT_ERROR)

    expect(requests).toBe(0)
    await expect(page).toHaveURL(/\/app\/products\/add$/)
  })

  test("shows the API's error and keeps the form editable when the product can't be created", async ({
    page,
  }) => {
    const handle = unique("taken")
    await postOk(page.request, "/admin/products", {
      title: `Existing ${handle}`,
      handle,
      options: [{ title: "Size", values: ["M"] }],
    })
    const title = `Duplicate ${handle}`

    await openPage(page)
    await page.getByLabel("Title", { exact: true }).fill(title)
    await section(page, "Search engine listing")
      .getByLabel("URL handle")
      .fill(handle)
    await save(page).click()

    await expect(
      page.getByRole("alert").filter({ hasText: "already exists" })
    ).toBeVisible()
    await expect(save(page)).toBeEnabled()
    await expect(page.getByLabel("Title", { exact: true })).toBeEditable()
    expect(await productsTitled(page.request, title)).toEqual([])

    // Changing the handle and saving again creates it.
    await section(page, "Search engine listing")
      .getByLabel("URL handle")
      .fill(`${handle}-2`)
    await save(page).click()
    await waitForProductPage(page)
    expect(await productsTitled(page.request, title)).toHaveLength(1)
  })

  test("keeps the product when a later part fails, and retries just that part", async ({
    page,
  }) => {
    const title = `Retry ${unique("seo")}`
    let seoCalls = 0

    await page.route("**/admin/products/*/seo", async (route) => {
      if (route.request().method() !== "POST") {
        return route.continue()
      }

      seoCalls++

      if (seoCalls === 1) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            type: "unknown_error",
            message: "SEO is down",
          }),
        })
      }

      return route.continue()
    })

    await openPage(page)
    await page.getByLabel("Title", { exact: true }).fill(title)
    await section(page, "Pricing").getByLabel("Cost per item").fill("4")
    await section(page, "Search engine listing")
      .getByLabel("Page title")
      .fill("Retried title")
    await save(page).click()

    const status = page.getByTestId("add-product-save-status")
    await expect(status).toContainText(
      `"${title}" was created, but some parts weren't saved`
    )
    await expect(status.getByRole("listitem", { name: "SEO" })).toContainText(
      "SEO is down"
    )
    await expect(
      status.getByRole("listitem", { name: "Compare-at prices and costs" })
    ).toContainText("Saved")
    // Saving again would create a second product.
    await expect(save(page)).toBeDisabled()
    await expect(page.getByLabel("Title", { exact: true })).toBeDisabled()

    const [product] = await productsTitled(page.request, title)
    expect(product).toBeTruthy()

    await status.getByRole("button", { name: "Retry SEO" }).click()
    await waitForProductPage(page)
    expect(page.url()).toContain(product.id)

    expect(await productsTitled(page.request, title)).toHaveLength(1)
    const { product_seo } = await getJson(
      page.request,
      `/admin/products/${product.id}/seo`
    )
    expect(product_seo.title).toBe("Retried title")
    expect(seoCalls).toBe(2)
  })
})
