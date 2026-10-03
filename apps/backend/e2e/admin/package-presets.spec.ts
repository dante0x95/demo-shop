import { APIRequestContext, expect, Page, test } from "@playwright/test"

type Preset = {
  id: string
  name: string
  is_default: boolean
}

const unique = (label: string) =>
  `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const VALID_BODY = {
  length: 30,
  width: 20,
  height: 10.5,
  dimension_unit: "cm",
  weight: 0.25,
  weight_unit: "kg",
}

const createViaApi = async (
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<Preset> => {
  const res = await request.post("/admin/package-presets", {
    data: { ...VALID_BODY, ...data },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).package_preset
}

const listDefaultsViaApi = async (request: APIRequestContext) => {
  const res = await request.get("/admin/package-presets", {
    params: { is_default: "true" },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).package_presets as Preset[]
}

const deleteAllViaApi = async (request: APIRequestContext) => {
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

const rowFor = (page: Page, name: string) =>
  page.getByRole("row").filter({ hasText: name })

const openRowMenu = async (page: Page, name: string) => {
  await rowFor(page, name).getByRole("button").click()
}

const openCreateModal = async (page: Page) => {
  if (!page.url().endsWith("/app/settings/package-presets")) {
    await page.goto("/app/settings/package-presets")
  }
  await page.getByRole("button", { name: "Create preset" }).click()
  const modal = page.getByRole("dialog")
  await expect(
    modal.getByRole("heading", { name: "Create package preset" })
  ).toBeVisible()
  return modal
}

const pickOption = async (page: Page, combobox: string, option: string) => {
  await page.getByRole("combobox", { name: combobox }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

test.describe("Admin package presets settings page", () => {
  test("is reachable from settings and lists presets", async ({ page }) => {
    const name = unique("Listed")
    await createViaApi(page.request, { name })

    await page.goto("/app/settings")
    await page.getByRole("link", { name: "Package presets" }).click()

    await expect(page).toHaveURL(/\/app\/settings\/package-presets$/)
    await expect(
      page.getByRole("heading", { name: "Package presets" })
    ).toBeVisible()
    for (const header of [
      "Name",
      "Dimensions (L × W × H)",
      "Empty weight",
      "Default",
    ]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible()
    }

    const row = rowFor(page, name)
    await expect(row).toContainText("30 × 20 × 10.5 cm")
    await expect(row).toContainText("0.25 kg")
  })

  test("creates a preset that is persisted and shown first", async ({ page }) => {
    const name = unique("Created")
    const modal = await openCreateModal(page)

    await modal.getByLabel("Name").fill(name)
    await modal.getByLabel("Length").fill("40")
    await modal.getByLabel("Width").fill("30.5")
    await modal.getByLabel("Height").fill("12")
    await pickOption(page, "Dimension unit", "in")
    await modal.getByLabel("Empty weight").fill("0")
    await pickOption(page, "Weight unit", "lb")

    const created = page.waitForResponse(
      (res) =>
        res.url().endsWith("/admin/package-presets") &&
        res.request().method() === "POST"
    )
    await modal.getByRole("button", { name: "Save" }).click()
    const response = await created
    expect(response.status()).toBe(200)
    const { package_preset } = await response.json()

    await expect(page.getByText(`Package preset "${name}" created`)).toBeVisible()
    await expect(modal).toBeHidden()

    const firstRow = page.getByRole("row").nth(1)
    await expect(firstRow).toContainText(name)
    await expect(firstRow).toContainText("40 × 30.5 × 12 in")
    await expect(firstRow).toContainText("0 lb")

    // Survives a reload, so the row comes from the server.
    await page.reload()
    await expect(rowFor(page, name)).toBeVisible()

    const res = await page.request.get(
      `/admin/package-presets/${package_preset.id}`
    )
    expect(res.status()).toBe(200)
    expect((await res.json()).package_preset).toMatchObject({
      name,
      length: 40,
      width: 30.5,
      height: 12,
      dimension_unit: "in",
      weight: 0,
      weight_unit: "lb",
      is_default: false,
    })
  })

  test("creates a default preset that replaces the current default", async ({
    page,
  }) => {
    const previous = await createViaApi(page.request, {
      name: unique("Old default"),
      is_default: true,
    })
    const name = unique("New default")
    await page.goto("/app/settings/package-presets")
    await expect(rowFor(page, previous.name)).toContainText("Default")
    const modal = await openCreateModal(page)

    await modal.getByLabel("Name").fill(name)
    await modal.getByLabel("Length").fill("10")
    await modal.getByLabel("Width").fill("10")
    await modal.getByLabel("Height").fill("10")
    await pickOption(page, "Dimension unit", "cm")
    await modal.getByLabel("Empty weight").fill("100")
    await pickOption(page, "Weight unit", "g")
    await modal.getByLabel("Default package").click()
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal).toBeHidden()
    await expect(rowFor(page, name)).toContainText("Default")
    await expect(rowFor(page, previous.name)).not.toContainText("Default")

    const defaults = await listDefaultsViaApi(page.request)
    expect(defaults.map((preset) => preset.name)).toEqual([name])
  })

  test("shows the API error for missing fields", async ({ page }) => {
    const name = unique("Incomplete")
    // Same payload the form sends with only a name.
    const apiRes = await page.request.post("/admin/package-presets", {
      data: { name, is_default: false },
    })
    expect(apiRes.status()).toBe(400)
    const { message } = await apiRes.json()

    const modal = await openCreateModal(page)
    await modal.getByLabel("Name").fill(name)
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal.getByText(message)).toBeVisible()
    await expect(modal).toBeVisible()
  })

  test("shows the API error for a negative dimension", async ({ page }) => {
    const name = unique("Negative")
    const apiRes = await page.request.post("/admin/package-presets", {
      data: { ...VALID_BODY, name, length: -5, is_default: false },
    })
    expect(apiRes.status()).toBe(400)
    const { message } = await apiRes.json()

    const modal = await openCreateModal(page)
    await modal.getByLabel("Name").fill(name)
    await modal.getByLabel("Length").fill("-5")
    await modal.getByLabel("Width").fill("20")
    await modal.getByLabel("Height").fill("10.5")
    await pickOption(page, "Dimension unit", "cm")
    await modal.getByLabel("Empty weight").fill("0.25")
    await pickOption(page, "Weight unit", "kg")
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal.getByText(message)).toBeVisible()
    await expect(modal).toBeVisible()
  })

  test("sets a preset as the default from its row", async ({ page }) => {
    const previous = await createViaApi(page.request, {
      name: unique("Was default"),
      is_default: true,
    })
    const next = await createViaApi(page.request, { name: unique("Becomes default") })

    await page.goto("/app/settings/package-presets")

    // The current default has no "Set as default" action.
    await openRowMenu(page, previous.name)
    const deleteItem = page.getByRole("menuitem", { name: "Delete" })
    await expect(deleteItem).toBeVisible()
    await expect(
      page.getByRole("menuitem", { name: "Set as default" })
    ).toHaveCount(0)
    // Reload to close the menu (the row menu ignores Escape).
    await page.reload()

    await openRowMenu(page, next.name)
    await page.getByRole("menuitem", { name: "Set as default" }).click()

    await expect(page.getByText(`"${next.name}" is now the default`)).toBeVisible()
    await expect(rowFor(page, next.name)).toContainText("Default")
    await expect(rowFor(page, previous.name)).not.toContainText("Default")

    const defaults = await listDefaultsViaApi(page.request)
    expect(defaults.map((preset) => preset.id)).toEqual([next.id])
  })

  test("shows the API error when setting a default fails", async ({ page }) => {
    const preset = await createViaApi(page.request, { name: unique("Conflict") })
    const message =
      "Another package preset was set as the default at the same time. Retry the request."

    await page.route(/\/admin\/package-presets\/[^/]+\/set-default/, (route) =>
      route.fulfill({ status: 409, json: { type: "conflict", message } })
    )

    await page.goto("/app/settings/package-presets")
    await openRowMenu(page, preset.name)
    await page.getByRole("menuitem", { name: "Set as default" }).click()

    await expect(page.getByText(message)).toBeVisible()
    await expect(rowFor(page, preset.name)).not.toContainText("Default")
  })

  test("deletes a preset after confirming", async ({ page }) => {
    const preset = await createViaApi(page.request, { name: unique("Delete me") })

    await page.goto("/app/settings/package-presets")
    await openRowMenu(page, preset.name)
    await page.getByRole("menuitem", { name: "Delete" }).click()

    const prompt = page.getByRole("alertdialog")
    await expect(prompt.getByText("Delete package preset?")).toBeVisible()
    await expect(prompt).toContainText(`"${preset.name}" will be deleted.`)
    await prompt.getByRole("button", { name: "Delete" }).click()

    await expect(page.getByText(`"${preset.name}" deleted`)).toBeVisible()
    await expect(rowFor(page, preset.name)).toHaveCount(0)

    const res = await page.request.get(`/admin/package-presets/${preset.id}`)
    expect(res.status()).toBe(404)
  })

  test("warns that deleting the default leaves no default", async ({ page }) => {
    const preset = await createViaApi(page.request, {
      name: unique("Default to delete"),
      is_default: true,
    })

    await page.goto("/app/settings/package-presets")
    await openRowMenu(page, preset.name)
    await page.getByRole("menuitem", { name: "Delete" }).click()

    const prompt = page.getByRole("alertdialog")
    await expect(prompt).toContainText(
      "is the default preset. After deleting it there is no default until you set another one."
    )
    await prompt.getByRole("button", { name: "Delete" }).click()

    await expect(rowFor(page, preset.name)).toHaveCount(0)
    expect(await listDefaultsViaApi(page.request)).toEqual([])
  })

  test("keeps the preset when the delete is cancelled", async ({ page }) => {
    const preset = await createViaApi(page.request, { name: unique("Keep me") })

    await page.goto("/app/settings/package-presets")
    await openRowMenu(page, preset.name)
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click()

    await expect(page.getByRole("alertdialog")).toBeHidden()
    await expect(rowFor(page, preset.name)).toBeVisible()
    const res = await page.request.get(`/admin/package-presets/${preset.id}`)
    expect(res.status()).toBe(200)
  })

  test("paginates 20 presets per page, newest first", async ({ page }) => {
    const prefix = unique("Page")
    const names = Array.from(
      { length: 21 },
      (_, i) => `${prefix} ${String(i + 1).padStart(2, "0")}`
    )

    // Sequential so created_at follows the array order.
    for (const name of names) {
      await createViaApi(page.request, { name })
    }

    await page.goto("/app/settings/package-presets")

    // Newest first: presets 21..02 fill page 1, preset 01 moves to page 2.
    await expect(page.getByRole("row")).toHaveCount(21)
    await expect(page.getByRole("row").nth(1)).toContainText(names[20])
    await expect(rowFor(page, names[0])).toHaveCount(0)

    await page.getByRole("button", { name: "Next" }).click()

    await expect(page.getByRole("row").nth(1)).toContainText(names[0])
  })

  test("goes back a page after deleting the only preset on the last page", async ({
    page,
  }) => {
    // The list has no filter, so start from an empty list to know the pages.
    await deleteAllViaApi(page.request)
    const prefix = unique("Last page")
    const names = Array.from(
      { length: 21 },
      (_, i) => `${prefix} ${String(i + 1).padStart(2, "0")}`
    )

    for (const name of names) {
      await createViaApi(page.request, { name })
    }

    await page.goto("/app/settings/package-presets")
    await page.getByRole("button", { name: "Next" }).click()
    await expect(page.getByRole("row")).toHaveCount(2)

    await openRowMenu(page, names[0])
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
    await expect(page.getByText(`"${names[0]}" deleted`)).toBeVisible()

    // Page 2 no longer exists, so the page shows page 1 with the other 20.
    await expect(page.getByRole("row")).toHaveCount(21)
    await expect(page.getByRole("row").nth(1)).toContainText(names[20])
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  test("shows an error with a retry when the list fails to load", async ({
    page,
  }) => {
    const preset = await createViaApi(page.request, { name: unique("Retry") })

    const listRequest = /\/admin\/package-presets\?/
    await page.route(listRequest, (route) =>
      route.fulfill({
        status: 500,
        json: { type: "unknown_error", message: "Presets are unavailable" },
      })
    )

    await page.goto("/app/settings/package-presets")

    const alert = page.getByRole("alert")
    await expect(alert).toContainText("The package presets could not be loaded")
    await expect(alert).toContainText("Presets are unavailable")
    await expect(page.getByRole("table")).toHaveCount(0)

    await page.unroute(listRequest)
    await alert.getByRole("button", { name: "Retry" }).click()

    await expect(page.getByRole("alert")).toHaveCount(0)
    await expect(rowFor(page, preset.name)).toBeVisible()
  })
})

test.describe("Admin package presets settings page without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("redirects to login", async ({ page }) => {
    await page.goto("/app/settings/package-presets")

    await expect(page).toHaveURL(/\/app\/login/)
  })
})
