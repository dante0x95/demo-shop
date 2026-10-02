import { APIRequestContext, expect, Page, test } from "@playwright/test"
import { execFileSync } from "child_process"
import path from "path"
import { E2E_DATABASE_URL } from "../env"

const uniqueName = (label: string) =>
  `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const createBrandViaApi = async (
  request: APIRequestContext,
  data: Record<string, unknown>
) => {
  const res = await request.post("/admin/brands", { data })
  expect(res.status()).toBe(200)
  return (await res.json()).brand
}

const createProductViaApi = async (request: APIRequestContext, title: string) => {
  // Medusa requires at least one product option.
  const res = await request.post("/admin/products", {
    data: { title, options: [{ title: "Size", values: ["M"] }] },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).product
}

// No HTTP route links a product to a brand yet, so use the link service directly.
const linkProductToBrand = (productId: string, brandId: string) => {
  execFileSync(
    "npx",
    [
      "medusa",
      "exec",
      "./e2e/fixtures/link-product-brand.ts",
      productId,
      brandId,
    ],
    {
      cwd: path.resolve(__dirname, "../.."),
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
      stdio: "pipe",
    }
  )
}

// The error the drawer shows must be the API's own 400 message.
const apiUpdateErrorMessage = async (
  request: APIRequestContext,
  id: string,
  data: Record<string, unknown>
) => {
  const res = await request.post(`/admin/brands/${id}`, { data })
  expect(res.status()).toBe(400)
  return (await res.json()).message as string
}

const openBrandActions = async (page: Page) => {
  await page.getByRole("button", { name: "Brand actions" }).click()
}

const openEditDrawer = async (page: Page, id: string) => {
  await page.goto(`/app/brands/${id}`)
  await openBrandActions(page)
  await page.getByRole("menuitem", { name: "Edit" }).click()
  const drawer = page.getByRole("dialog")
  await expect(drawer.getByText("Edit brand")).toBeVisible()
  return drawer
}

test.describe("Admin brand detail page", () => {
  test("opens from a row in the brands list", async ({ page }) => {
    const name = uniqueName("Detail")
    const brand = await createBrandViaApi(page.request, {
      name,
      description: "Shown on detail",
      logo_url: "https://example.com/logo.png",
    })

    await page.goto("/app/brands")
    await page.getByRole("row").filter({ hasText: name }).click()

    await expect(page).toHaveURL(new RegExp(`/app/brands/${brand.id}$`))
    await expect(page.getByRole("heading", { name })).toBeVisible()
    await expect(page.getByText(brand.handle, { exact: true })).toBeVisible()
    await expect(page.getByText("Shown on detail")).toBeVisible()
    await expect(page.getByText("https://example.com/logo.png")).toBeVisible()
    await expect(page.getByText("Active", { exact: true })).toBeVisible()
    await expect(page.getByText("No products linked to this brand")).toBeVisible()
  })

  test("edits a brand and the change persists after reload", async ({ page }) => {
    const brand = await createBrandViaApi(page.request, {
      name: uniqueName("Before edit"),
      description: "Old description",
    })
    const newName = uniqueName("After edit")
    const drawer = await openEditDrawer(page, brand.id)

    await expect(drawer.getByLabel("Name")).toHaveValue(brand.name)
    await drawer.getByLabel("Name").fill(newName)
    await drawer.getByLabel("Description (optional)").fill("")
    await drawer.getByLabel("Active").click()
    await drawer.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText(`Brand "${newName}" updated`)).toBeVisible()
    await expect(drawer).toBeHidden()
    await expect(page.getByRole("heading", { name: newName })).toBeVisible()
    await expect(page.getByText("Inactive", { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByRole("heading", { name: newName })).toBeVisible()
    await expect(page.getByText("Old description")).toHaveCount(0)

    const res = await page.request.get(`/admin/brands/${brand.id}`)
    expect(res.status()).toBe(200)
    expect((await res.json()).brand).toMatchObject({
      id: brand.id,
      name: newName,
      handle: brand.handle,
      description: null,
      is_active: false,
    })
  })

  test("shows the API error for a duplicate name regardless of case", async ({
    page,
  }) => {
    const other = await createBrandViaApi(page.request, {
      name: uniqueName("Taken name"),
    })
    const brand = await createBrandViaApi(page.request, {
      name: uniqueName("Renamed"),
    })
    const drawer = await openEditDrawer(page, brand.id)

    await drawer.getByLabel("Name").fill(other.name.toUpperCase())
    await drawer.getByRole("button", { name: "Save" }).click()

    await expect(
      drawer.getByText("A brand with this name already exists")
    ).toBeVisible()
    await expect(drawer).toBeVisible()
  })

  test("shows the API error for a duplicate handle", async ({ page }) => {
    const other = await createBrandViaApi(page.request, {
      name: uniqueName("Handle owner"),
    })
    const brand = await createBrandViaApi(page.request, {
      name: uniqueName("Handle taker"),
    })
    const drawer = await openEditDrawer(page, brand.id)

    await drawer.getByLabel("Handle").fill(other.handle)
    await drawer.getByRole("button", { name: "Save" }).click()

    await expect(
      drawer.getByText("A brand with this handle already exists")
    ).toBeVisible()
  })

  test("shows the API error for an invalid logo URL", async ({ page }) => {
    const brand = await createBrandViaApi(page.request, {
      name: uniqueName("Bad URL"),
    })
    // Same payload the drawer sends.
    const message = await apiUpdateErrorMessage(page.request, brand.id, {
      name: brand.name,
      handle: brand.handle,
      description: null,
      logo_url: "not-a-url",
      banner_url: null,
      is_active: true,
    })
    const drawer = await openEditDrawer(page, brand.id)

    await drawer.getByLabel("Logo URL (optional)").fill("not-a-url")
    await drawer.getByRole("button", { name: "Save" }).click()

    await expect(drawer.getByText(message)).toBeVisible()
  })

  test("lists linked products with a link to the product page", async ({
    page,
  }) => {
    const brand = await createBrandViaApi(page.request, {
      name: uniqueName("With product"),
    })
    const product = await createProductViaApi(page.request, uniqueName("Shirt"))
    linkProductToBrand(product.id, brand.id)

    await page.goto(`/app/brands/${brand.id}`)

    const productLink = page.getByRole("link", { name: product.title })
    await expect(productLink).toBeVisible()
    await expect(productLink).toHaveAttribute(
      "href",
      `/app/products/${product.id}`
    )
    await expect(page.getByText("No products linked to this brand")).toHaveCount(0)
  })

  test("keeps the brand when the delete prompt is cancelled", async ({
    page,
  }) => {
    const brand = await createBrandViaApi(page.request, {
      name: uniqueName("Kept"),
    })

    await page.goto(`/app/brands/${brand.id}`)
    await openBrandActions(page)
    await page.getByRole("menuitem", { name: "Delete" }).click()
    const prompt = page.getByRole("alertdialog")
    await prompt.getByRole("button", { name: "Cancel" }).click()

    await expect(prompt).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`/app/brands/${brand.id}$`))
    const res = await page.request.get(`/admin/brands/${brand.id}`)
    expect(res.status()).toBe(200)
  })

  test("deletes a brand and keeps its linked product", async ({ page }) => {
    const name = uniqueName("Deleted")
    const brand = await createBrandViaApi(page.request, { name })
    const product = await createProductViaApi(page.request, uniqueName("Kept shirt"))
    linkProductToBrand(product.id, brand.id)

    await page.goto(`/app/brands/${brand.id}`)
    await openBrandActions(page)
    await page.getByRole("menuitem", { name: "Delete" }).click()
    const prompt = page.getByRole("alertdialog")
    await expect(
      prompt.getByText("Products linked to this brand are unlinked, not deleted.")
    ).toBeVisible()
    await prompt.getByRole("button", { name: "Delete" }).click()

    await expect(page).toHaveURL(/\/app\/brands$/)
    await expect(page.getByText(`Brand "${name}" deleted`)).toBeVisible()
    await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0)

    const brandRes = await page.request.get(`/admin/brands/${brand.id}`)
    expect(brandRes.status()).toBe(404)
    const productRes = await page.request.get(`/admin/products/${product.id}`)
    expect(productRes.status()).toBe(200)
  })

  test("shows a not-found state for an unknown brand", async ({ page }) => {
    await page.goto("/app/brands/brand_does_not_exist")

    await expect(page.getByRole("heading", { name: "Brand not found" })).toBeVisible()
    await page.getByRole("link", { name: "Back to brands" }).click()
    await expect(page).toHaveURL(/\/app\/brands$/)
  })
})
