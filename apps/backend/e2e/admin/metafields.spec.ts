import { expect, Page, test } from "@playwright/test"
import {
  createDefinitionViaApi,
  createProductViaApi,
  deleteAllUnstructuredViaApi,
  deleteDefinitionViaApi,
  listProductMetafieldsViaApi,
  setProductMetafieldsViaApi,
  uniqueKey,
} from "../fixtures/metafields"

const PAGE_URL = "/app/settings/metafields"

const definitionsTable = (page: Page) =>
  page.getByRole("table").first()

const unstructuredSection = (page: Page) =>
  page.getByTestId("unstructured-metafields")

const rowFor = (page: Page, text: string) =>
  page.getByRole("row").filter({ hasText: text })

const openRowMenu = async (page: Page, text: string) => {
  await rowFor(page, text).getByRole("button").click()
}

const openCreateModal = async (page: Page) => {
  if (!page.url().endsWith(PAGE_URL)) {
    await page.goto(PAGE_URL)
  }
  await page.getByRole("button", { name: "Create definition" }).click()
  const modal = page.getByRole("dialog")
  await expect(
    modal.getByRole("heading", { name: "Create metafield definition" })
  ).toBeVisible()
  return modal
}

const pickOption = async (page: Page, combobox: string, option: string) => {
  await page.getByRole("combobox", { name: combobox }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

test.describe("Admin metafields settings page", () => {
  test("is reachable from settings and lists the definitions", async ({
    page,
  }) => {
    const key = uniqueKey("listed")
    await createDefinitionViaApi(page.request, {
      key,
      label: `Listed ${key}`,
      type: "select",
      options: ["Cotton", "Linen"],
    })

    await page.goto("/app/settings")
    await page.getByRole("link", { name: "Metafields" }).click()

    await expect(page).toHaveURL(/\/app\/settings\/metafields$/)
    await expect(
      page.getByRole("heading", { name: "Metafields", exact: true })
    ).toBeVisible()
    for (const header of ["Name", "Key", "Type", "Storefront"]) {
      await expect(
        definitionsTable(page).getByRole("columnheader", { name: header })
      ).toBeVisible()
    }

    const row = rowFor(page, key)
    await expect(row).toContainText(`Listed ${key}`)
    await expect(row).toContainText("Select: Cotton, Linen")
    await expect(row).toContainText("Hidden")
    // Only one owner type is configured, so there is no picker.
    await expect(page.getByRole("combobox", { name: "Owner type" })).toHaveCount(0)
  })

  test("creates a text definition with a key suggested from its name", async ({
    page,
  }) => {
    const suffix = uniqueKey("x").slice(2)
    const label = `Care Instructions ${suffix}`
    const modal = await openCreateModal(page)

    await modal.getByLabel("Name").fill(label)
    await expect(modal.getByLabel("Key")).toHaveValue(
      `care_instructions_${suffix}`
    )
    await pickOption(page, "Type", "Text")
    // Options are only asked for a select.
    await expect(modal.getByLabel("Options")).toHaveCount(0)

    const created = page.waitForResponse(
      (res) =>
        res.url().endsWith("/admin/metafield-definitions") &&
        res.request().method() === "POST"
    )
    await modal.getByRole("button", { name: "Save" }).click()
    const response = await created
    expect(response.status()).toBe(200)
    const { metafield_definition } = await response.json()

    await expect(page.getByText(`Metafield "${label}" created`)).toBeVisible()
    await expect(modal).toBeHidden()

    const firstRow = definitionsTable(page).getByRole("row").nth(1)
    await expect(firstRow).toContainText(label)
    await expect(firstRow).toContainText(`care_instructions_${suffix}`)
    await expect(firstRow).toContainText("Text")

    const res = await page.request.get(
      `/admin/metafield-definitions/${metafield_definition.id}`
    )
    expect(res.status()).toBe(200)
    expect((await res.json()).metafield_definition).toMatchObject({
      key: `care_instructions_${suffix}`,
      label,
      type: "text",
      options: null,
      owner_type: "product",
      storefront_access: false,
    })
  })

  test("creates a select definition with one option per line and a typed key", async ({
    page,
  }) => {
    const key = uniqueKey("material")
    const modal = await openCreateModal(page)

    await modal.getByLabel("Name").fill("Material")
    await modal.getByLabel("Key").fill(key)
    // Once typed, the key no longer follows the name.
    await modal.getByLabel("Name").fill("Main material")
    await expect(modal.getByLabel("Key")).toHaveValue(key)
    await pickOption(page, "Type", "Select")
    await modal.getByLabel("Options").fill("Cotton\n\n  Linen  \nWool")
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal).toBeHidden()
    await expect(rowFor(page, key)).toContainText("Select: Cotton, Linen, Wool")

    const res = await page.request.get("/admin/metafield-definitions", {
      params: { owner_type: "product", limit: 100 },
    })
    const definition = (await res.json()).metafield_definitions.find(
      (d: { key: string }) => d.key === key
    )
    expect(definition).toMatchObject({
      label: "Main material",
      type: "select",
      options: ["Cotton", "Linen", "Wool"],
    })
  })

  test("shows the API error for an invalid key", async ({ page }) => {
    const apiRes = await page.request.post("/admin/metafield-definitions", {
      data: { key: "Bad Key", label: "Bad", type: "text", owner_type: "product" },
    })
    expect(apiRes.status()).toBe(400)
    const { message } = await apiRes.json()

    const modal = await openCreateModal(page)
    await modal.getByLabel("Name").fill("Bad")
    await modal.getByLabel("Key").fill("Bad Key")
    await pickOption(page, "Type", "Text")
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal.getByRole("alert")).toContainText(message)
    await expect(modal).toBeVisible()
  })

  test("shows why existing values of the key don't fit a new definition", async ({
    page,
  }) => {
    const key = uniqueKey("fit")
    const product = await createProductViaApi(page.request, `Fit ${key}`)
    const definition = await createDefinitionViaApi(page.request, { key })
    await setProductMetafieldsViaApi(page.request, product.id, [
      { key, value: "Cotton" },
    ])
    await deleteDefinitionViaApi(page.request, definition.id)

    // Same request the form sends; a 409 creates nothing.
    const apiRes = await page.request.post("/admin/metafield-definitions", {
      data: { key, label: "Fit", type: "number", owner_type: "product" },
    })
    expect(apiRes.status()).toBe(409)
    const { message } = await apiRes.json()
    expect(message).toContain("existing values with this key are of type text")

    const modal = await openCreateModal(page)
    await modal.getByLabel("Name").fill("Fit")
    await modal.getByLabel("Key").fill(key)
    await pickOption(page, "Type", "Number")
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal.getByRole("alert")).toContainText(message)
    await expect(modal).toBeVisible()
  })

  test("shows a definition on the storefront and hides it again", async ({
    page,
  }) => {
    const key = uniqueKey("access")
    const definition = await createDefinitionViaApi(page.request, { key })

    await page.goto(PAGE_URL)
    await openRowMenu(page, key)
    await page.getByRole("menuitem", { name: "Show on storefront" }).click()

    await expect(
      page.getByText(`"${key}" is now shown on the storefront`)
    ).toBeVisible()
    await expect(rowFor(page, key)).toContainText("Visible")
    let res = await page.request.get(
      `/admin/metafield-definitions/${definition.id}`
    )
    expect((await res.json()).metafield_definition.storefront_access).toBe(true)

    await openRowMenu(page, key)
    await expect(
      page.getByRole("menuitem", { name: "Show on storefront" })
    ).toHaveCount(0)
    await page.getByRole("menuitem", { name: "Hide from storefront" }).click()

    await expect(rowFor(page, key)).toContainText("Hidden")
    res = await page.request.get(`/admin/metafield-definitions/${definition.id}`)
    expect((await res.json()).metafield_definition.storefront_access).toBe(false)
  })

  test("deletes a definition and keeps its values as unstructured", async ({
    page,
  }) => {
    await deleteAllUnstructuredViaApi(page.request)
    const key = uniqueKey("kept")
    const product = await createProductViaApi(page.request, `Kept ${key}`)
    const definition = await createDefinitionViaApi(page.request, { key })
    await setProductMetafieldsViaApi(page.request, product.id, [
      { key, value: "Keep me" },
    ])

    await page.goto(PAGE_URL)
    await expect(unstructuredSection(page)).toContainText(
      "No unstructured metafields"
    )
    await openRowMenu(page, key)
    await page.getByRole("menuitem", { name: "Delete" }).click()

    const prompt = page.getByRole("alertdialog")
    await expect(prompt).toContainText("Delete metafield definition?")
    await expect(prompt).toContainText("Its values are kept as unstructured")
    await expect(prompt.getByRole("checkbox")).not.toBeChecked()
    await prompt.getByRole("button", { name: "Delete" }).click()

    await expect(page.getByText(`"${key}" deleted`)).toBeVisible()
    await expect(definitionsTable(page).getByText(key)).toHaveCount(0)
    const unstructuredRow = unstructuredSection(page)
      .getByRole("row")
      .filter({ hasText: key })
    await expect(unstructuredRow.getByRole("cell").nth(1)).toHaveText("Text")
    await expect(unstructuredRow.getByRole("cell").nth(2)).toHaveText("1")

    const res = await page.request.get(
      `/admin/metafield-definitions/${definition.id}`
    )
    expect(res.status()).toBe(404)
    const values = await listProductMetafieldsViaApi(page.request, product.id)
    expect(values).toEqual([
      expect.objectContaining({ key, value: "Keep me", definition: null }),
    ])
  })

  test("deletes a definition together with its values", async ({ page }) => {
    const key = uniqueKey("gone")
    const product = await createProductViaApi(page.request, `Gone ${key}`)
    await createDefinitionViaApi(page.request, { key })
    await setProductMetafieldsViaApi(page.request, product.id, [
      { key, value: "Delete me" },
    ])

    await page.goto(PAGE_URL)
    await openRowMenu(page, key)
    await page.getByRole("menuitem", { name: "Delete" }).click()
    const prompt = page.getByRole("alertdialog")
    await prompt.getByLabel("Also delete its values").click()
    await prompt.getByRole("button", { name: "Delete" }).click()

    await expect(page.getByText(`"${key}" and its values deleted`)).toBeVisible()
    await expect(page.getByRole("row").filter({ hasText: key })).toHaveCount(0)
    expect(await listProductMetafieldsViaApi(page.request, product.id)).toEqual([])
  })

  test("keeps the definition when the delete is cancelled", async ({ page }) => {
    const key = uniqueKey("cancel")
    const definition = await createDefinitionViaApi(page.request, { key })

    await page.goto(PAGE_URL)
    await openRowMenu(page, key)
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancel" })
      .click()

    await expect(page.getByRole("alertdialog")).toBeHidden()
    await expect(rowFor(page, key)).toBeVisible()
    const res = await page.request.get(
      `/admin/metafield-definitions/${definition.id}`
    )
    expect(res.status()).toBe(200)
  })

  test("gives an unstructured key its definition back, reconnecting its values", async ({
    page,
  }) => {
    await deleteAllUnstructuredViaApi(page.request)
    const key = uniqueKey("again")
    const product = await createProductViaApi(page.request, `Again ${key}`)
    const definition = await createDefinitionViaApi(page.request, {
      key,
      type: "number",
    })
    await setProductMetafieldsViaApi(page.request, product.id, [
      { key, value: 42 },
    ])
    await deleteDefinitionViaApi(page.request, definition.id)

    await page.goto(PAGE_URL)
    await unstructuredSection(page)
      .getByRole("row")
      .filter({ hasText: key })
      .getByRole("button")
      .click()
    await page.getByRole("menuitem", { name: "Create definition" }).click()

    const modal = page.getByRole("dialog")
    await expect(modal.getByLabel("Key")).toHaveValue(key)
    await expect(page.getByRole("combobox", { name: "Type" })).toHaveText(
      "Number"
    )
    // A given key doesn't follow the name.
    await modal.getByLabel("Name").fill("Weight in grams")
    await expect(modal.getByLabel("Key")).toHaveValue(key)
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal).toBeHidden()
    await expect(rowFor(page, key).first()).toContainText("Weight in grams")
    await expect(unstructuredSection(page)).toContainText(
      "No unstructured metafields"
    )
    const values = await listProductMetafieldsViaApi(page.request, product.id)
    expect(values).toEqual([
      expect.objectContaining({
        key,
        value: 42,
        definition: expect.objectContaining({ label: "Weight in grams" }),
      }),
    ])
  })

  test("deletes every value of an unstructured key after confirming", async ({
    page,
  }) => {
    await deleteAllUnstructuredViaApi(page.request)
    const key = uniqueKey("purge")
    const first = await createProductViaApi(page.request, `Purge A ${key}`)
    const second = await createProductViaApi(page.request, `Purge B ${key}`)
    const definition = await createDefinitionViaApi(page.request, {
      key,
      type: "boolean",
    })
    await setProductMetafieldsViaApi(page.request, first.id, [
      { key, value: true },
    ])
    await setProductMetafieldsViaApi(page.request, second.id, [
      { key, value: false },
    ])
    await deleteDefinitionViaApi(page.request, definition.id)

    await page.goto(PAGE_URL)
    const row = unstructuredSection(page).getByRole("row").filter({ hasText: key })
    await expect(row.getByRole("cell").nth(1)).toHaveText("True or false")
    await expect(row.getByRole("cell").nth(2)).toHaveText("2")
    await row.getByRole("button").click()
    await page.getByRole("menuitem", { name: "Delete values" }).click()

    const prompt = page.getByRole("alertdialog")
    await expect(prompt).toContainText(
      `The 2 values stored under ${key} will be deleted from every item.`
    )
    await prompt.getByRole("button", { name: "Delete" }).click()

    await expect(page.getByText(`Deleted 2 values of ${key}`)).toBeVisible()
    await expect(unstructuredSection(page)).toContainText(
      "No unstructured metafields"
    )
    expect(await listProductMetafieldsViaApi(page.request, first.id)).toEqual([])
    expect(await listProductMetafieldsViaApi(page.request, second.id)).toEqual([])
  })

  test("shows an error with a retry when the definitions fail to load", async ({
    page,
  }) => {
    const key = uniqueKey("retry")
    await createDefinitionViaApi(page.request, { key })

    const listRequest = /\/admin\/metafield-definitions\?/
    await page.route(listRequest, (route) =>
      route.fulfill({
        status: 500,
        json: { type: "unknown_error", message: "Definitions are unavailable" },
      })
    )

    await page.goto(PAGE_URL)

    const alert = page.getByRole("alert")
    await expect(alert).toContainText(
      "The metafield definitions could not be loaded"
    )
    await expect(alert).toContainText("Definitions are unavailable")

    await page.unroute(listRequest)
    await alert.getByRole("button", { name: "Retry" }).click()

    await expect(page.getByRole("alert")).toHaveCount(0)
    await expect(rowFor(page, key)).toBeVisible()
  })
})

test.describe("Admin metafields settings page without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("redirects to login", async ({ page }) => {
    await page.goto(PAGE_URL)

    await expect(page).toHaveURL(/\/app\/login/)
  })
})
