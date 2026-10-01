import { APIRequestContext, expect, Page, test } from "@playwright/test"

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

// The error the form shows must be the API's own 400 message.
const apiErrorMessage = async (
  request: APIRequestContext,
  data: Record<string, unknown>
) => {
  const res = await request.post("/admin/brands", { data })
  expect(res.status()).toBe(400)
  return (await res.json()).message as string
}

const openCreateModal = async (page: Page) => {
  await page.goto("/app/brands")
  await page.getByRole("button", { name: "Create brand" }).click()
  const modal = page.getByRole("dialog")
  await expect(modal.getByRole("heading", { name: "Create brand" })).toBeVisible()
  return modal
}

test.describe("Admin brands page", () => {
  test("is reachable from the sidebar and lists brands", async ({ page }) => {
    const name = uniqueName("Sidebar")
    await createBrandViaApi(page.request, { name })

    await page.goto("/app")
    await page.getByRole("link", { name: "Brands" }).click()

    await expect(page).toHaveURL(/\/app\/brands$/)
    await expect(page.getByRole("heading", { name: "Brands" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "Handle" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible()
    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible()
  })

  test("creates a brand and shows it first in the list", async ({ page }) => {
    const name = uniqueName("Created")
    const modal = await openCreateModal(page)

    await modal.getByLabel("Name", { exact: true }).fill(name)
    await modal.getByLabel("Description (optional)").fill("Made by E2E")
    await modal.getByLabel("Logo URL (optional)").fill("https://example.com/logo.png")
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText(`Brand "${name}" created`)).toBeVisible()
    await expect(modal).toBeHidden()

    const firstRow = page.getByRole("row").nth(1)
    await expect(firstRow).toContainText(name)
    await expect(firstRow).toContainText("Active")
  })

  test("creates an inactive brand with an explicit handle", async ({ page }) => {
    const name = uniqueName("Inactive")
    const handle = `inactive-${Date.now()}`
    const modal = await openCreateModal(page)

    await modal.getByLabel("Name", { exact: true }).fill(name)
    await modal.getByLabel("Handle (optional)").fill(handle)
    await modal.getByLabel("Active").click()
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal).toBeHidden()
    const row = page.getByRole("row").filter({ hasText: name })
    await expect(row).toContainText(handle)
    await expect(row).toContainText("Inactive")
  })

  test("shows the API error when name is missing", async ({ page }) => {
    // Same payload the form sends with an empty name.
    const message = await apiErrorMessage(page.request, {
      name: "",
      is_active: true,
    })
    const modal = await openCreateModal(page)

    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal.getByText(message)).toBeVisible()
    await expect(modal).toBeVisible()
  })

  test("shows the API error for a duplicate name regardless of case", async ({
    page,
  }) => {
    const name = uniqueName("Duplicate")
    await createBrandViaApi(page.request, { name })
    const modal = await openCreateModal(page)

    await modal.getByLabel("Name", { exact: true }).fill(name.toUpperCase())
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(
      modal.getByText("A brand with this name already exists")
    ).toBeVisible()
  })

  test("shows the API error for a duplicate handle", async ({ page }) => {
    const existing = await createBrandViaApi(page.request, {
      name: uniqueName("Handle owner"),
    })
    const modal = await openCreateModal(page)

    await modal.getByLabel("Name", { exact: true }).fill(uniqueName("Handle taker"))
    await modal.getByLabel("Handle (optional)").fill(existing.handle)
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(
      modal.getByText("A brand with this handle already exists")
    ).toBeVisible()
  })

  test("shows the API error for an invalid logo URL", async ({ page }) => {
    const name = uniqueName("Bad URL")
    const message = await apiErrorMessage(page.request, {
      name,
      is_active: true,
      logo_url: "not-a-url",
    })
    const modal = await openCreateModal(page)

    await modal.getByLabel("Name", { exact: true }).fill(name)
    await modal.getByLabel("Logo URL (optional)").fill("not-a-url")
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal.getByText(message)).toBeVisible()
  })

  test("paginates 20 brands per page", async ({ page }) => {
    const prefix = uniqueName("Page")
    const names = Array.from(
      { length: 21 },
      (_, i) => `${prefix} ${String(i + 1).padStart(2, "0")}`
    )

    // Sequential so created_at follows the array order.
    for (const name of names) {
      await createBrandViaApi(page.request, { name })
    }

    await page.goto("/app/brands")

    // Newest first: brands 21..02 fill page 1, brand 01 moves to page 2.
    await expect(page.getByRole("row")).toHaveCount(21)
    await expect(page.getByRole("row").nth(1)).toContainText(names[20])
    await expect(page.getByRole("row").filter({ hasText: names[0] })).toHaveCount(0)

    await page.getByRole("button", { name: "Next" }).click()

    await expect(page.getByRole("row").nth(1)).toContainText(names[0])
  })
})

test.describe("Admin brands page without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("redirects to login", async ({ page }) => {
    await page.goto("/app/brands")

    await expect(page).toHaveURL(/\/app\/login/)
  })
})
