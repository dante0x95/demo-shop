import { expect, Page, test } from "@playwright/test"
import {
  createDefinitionViaApi,
  createProductViaApi,
  deleteDefinitionViaApi,
  listProductMetafieldsViaApi,
  setProductMetafieldsViaApi,
  uniqueKey,
} from "../fixtures/metafields"

const widget = (page: Page) => page.getByTestId("product-metafields-widget")

const fieldRow = (page: Page, key: string) =>
  widget(page).getByTestId(`product-metafield-${key}`)

const openDrawer = async (page: Page) => {
  await widget(page).getByRole("button", { name: "Edit" }).click()
  const drawer = page.getByRole("dialog")
  await expect(drawer.getByText("Edit metafields")).toBeVisible()
  return drawer
}

const pickOption = async (page: Page, combobox: string, option: string) => {
  await page.getByRole("combobox", { name: combobox }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

const saveDrawer = async (page: Page) => {
  const drawer = page.getByRole("dialog")
  await drawer.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Metafields updated")).toBeVisible()
  await expect(drawer).toBeHidden()
}

// One definition of each type, with unique labels for the drawer's inputs.
const createDefinitionsOfEveryType = async (page: Page) => {
  const keys = {
    text: uniqueKey("disclosures"),
    number: uniqueKey("weight"),
    boolean: uniqueKey("fragile"),
    select: uniqueKey("fabric"),
  }

  await createDefinitionViaApi(page.request, {
    key: keys.text,
    label: `Disclosures ${keys.text}`,
    type: "text",
  })
  await createDefinitionViaApi(page.request, {
    key: keys.number,
    label: `Weight ${keys.number}`,
    type: "number",
  })
  await createDefinitionViaApi(page.request, {
    key: keys.boolean,
    label: `Fragile ${keys.boolean}`,
    type: "boolean",
  })
  await createDefinitionViaApi(page.request, {
    key: keys.select,
    label: `Fabric ${keys.select}`,
    type: "select",
    options: ["Cotton", "Linen"],
  })

  return keys
}

test.describe("Product metafields widget", () => {
  test("shows every product definition, with a dash when there is no value", async ({
    page,
  }) => {
    const keys = await createDefinitionsOfEveryType(page)
    const product = await createProductViaApi(page.request, `Show ${keys.text}`)
    await setProductMetafieldsViaApi(page.request, product.id, [
      { key: keys.number, value: 0 },
      { key: keys.boolean, value: false },
    ])

    await page.goto(`/app/products/${product.id}`)

    await expect(
      widget(page).getByRole("heading", { name: "Metafields" })
    ).toBeVisible()
    await expect(fieldRow(page, keys.text)).toContainText(
      `Disclosures ${keys.text}`
    )
    await expect(fieldRow(page, keys.text)).toContainText("-")
    await expect(fieldRow(page, keys.number)).toContainText("0")
    await expect(fieldRow(page, keys.boolean)).toContainText("False")
    await expect(fieldRow(page, keys.select)).toContainText("-")
  })

  test("saves a value of each type", async ({ page }) => {
    const keys = await createDefinitionsOfEveryType(page)
    const product = await createProductViaApi(page.request, `Save ${keys.text}`)

    await page.goto(`/app/products/${product.id}`)
    const drawer = await openDrawer(page)

    await drawer
      .getByLabel(`Disclosures ${keys.text}`)
      .fill("Contains small parts.\nKeep away from fire.")
    await drawer.getByLabel(`Weight ${keys.number}`).fill("12.5")
    await pickOption(page, `Fragile ${keys.boolean}`, "True")
    await pickOption(page, `Fabric ${keys.select}`, "Linen")
    await saveDrawer(page)

    await expect(fieldRow(page, keys.text)).toContainText(
      "Contains small parts.\nKeep away from fire."
    )
    await expect(fieldRow(page, keys.number)).toContainText("12.5")
    await expect(fieldRow(page, keys.boolean)).toContainText("True")
    await expect(fieldRow(page, keys.select)).toContainText("Linen")

    const values = await listProductMetafieldsViaApi(page.request, product.id)
    expect(
      Object.fromEntries(values.map(({ key, value }) => [key, value]))
    ).toEqual({
      [keys.text]: "Contains small parts.\nKeep away from fire.",
      [keys.number]: 12.5,
      [keys.boolean]: true,
      [keys.select]: "Linen",
    })
  })

  test("only offers a select's options", async ({ page }) => {
    const key = uniqueKey("size")
    await createDefinitionViaApi(page.request, {
      key,
      label: `Size ${key}`,
      type: "select",
      options: ["S", "M"],
    })
    const product = await createProductViaApi(page.request, `Options ${key}`)

    await page.goto(`/app/products/${product.id}`)
    await openDrawer(page)
    await page.getByRole("combobox", { name: `Size ${key}` }).click()

    await expect(page.getByRole("option")).toHaveText(["No value", "S", "M"])
  })

  test("removes the values of emptied fields", async ({ page }) => {
    const keys = await createDefinitionsOfEveryType(page)
    const product = await createProductViaApi(page.request, `Clear ${keys.text}`)
    await setProductMetafieldsViaApi(page.request, product.id, [
      { key: keys.text, value: "Old text" },
      { key: keys.number, value: 3 },
      { key: keys.boolean, value: true },
      { key: keys.select, value: "Cotton" },
    ])

    await page.goto(`/app/products/${product.id}`)
    await expect(fieldRow(page, keys.select)).toContainText("Cotton")
    const drawer = await openDrawer(page)

    await drawer.getByLabel(`Disclosures ${keys.text}`).fill("")
    await drawer.getByLabel(`Weight ${keys.number}`).fill("")
    await pickOption(page, `Fragile ${keys.boolean}`, "No value")
    // Left as it is: keeps its value.
    await expect(
      page.getByRole("combobox", { name: `Fabric ${keys.select}` })
    ).toHaveText("Cotton")
    await saveDrawer(page)

    for (const key of [keys.text, keys.number, keys.boolean]) {
      await expect(fieldRow(page, key)).toContainText("-")
    }
    await expect(fieldRow(page, keys.select)).toContainText("Cotton")

    const values = await listProductMetafieldsViaApi(page.request, product.id)
    expect(values.map(({ key, value }) => [key, value])).toEqual([
      [keys.select, "Cotton"],
    ])
  })

  test("shows, edits and removes unstructured values", async ({ page }) => {
    const key = uniqueKey("legacy")
    const removed = uniqueKey("obsolete")
    const product = await createProductViaApi(page.request, `Legacy ${key}`)
    const legacy = await createDefinitionViaApi(page.request, {
      key,
      type: "select",
      options: ["Red", "Blue"],
    })
    const obsolete = await createDefinitionViaApi(page.request, { key: removed })
    await setProductMetafieldsViaApi(page.request, product.id, [
      { key, value: "Red" },
      { key: removed, value: "Bye" },
    ])
    await deleteDefinitionViaApi(page.request, legacy.id)
    await deleteDefinitionViaApi(page.request, obsolete.id)

    await page.goto(`/app/products/${product.id}`)
    await expect(fieldRow(page, key)).toContainText("Unstructured")
    await expect(fieldRow(page, key)).toContainText("Red")
    await expect(fieldRow(page, removed)).toContainText("Unstructured")

    const drawer = await openDrawer(page)
    // Without its definition a select is plain text, not limited to options.
    await drawer.getByLabel(key).fill("Green")
    await drawer.getByLabel(removed).fill("")
    await saveDrawer(page)

    await expect(fieldRow(page, key)).toContainText("Green")
    await expect(fieldRow(page, removed)).toHaveCount(0)

    const values = await listProductMetafieldsViaApi(page.request, product.id)
    expect(values).toEqual([
      expect.objectContaining({ key, type: "select", value: "Green", definition: null }),
    ])
  })

  test("shows the API error and keeps the drawer open when saving fails", async ({
    page,
  }) => {
    const key = uniqueKey("failing")
    await createDefinitionViaApi(page.request, { key, label: `Failing ${key}` })
    const product = await createProductViaApi(page.request, `Fail ${key}`)
    const message = "Metafield values are unavailable"

    await page.route(`**/admin/products/${product.id}/metafields`, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 400,
            json: { type: "invalid_data", message },
          })
        : route.fallback()
    )

    await page.goto(`/app/products/${product.id}`)
    const drawer = await openDrawer(page)
    await drawer.getByLabel(`Failing ${key}`).fill("Anything")
    await drawer.getByRole("button", { name: "Save" }).click()

    await expect(drawer.getByRole("alert")).toContainText(message)
    await expect(drawer).toBeVisible()
    expect(await listProductMetafieldsViaApi(page.request, product.id)).toEqual([])
  })

  test("closes without a request when nothing changed", async ({ page }) => {
    const key = uniqueKey("untouched")
    await createDefinitionViaApi(page.request, { key, label: `Untouched ${key}` })
    const product = await createProductViaApi(page.request, `Same ${key}`)
    await setProductMetafieldsViaApi(page.request, product.id, [
      { key, value: "Same" },
    ])

    let writes = 0
    page.on("request", (request) => {
      if (
        request.url().includes(`/admin/products/${product.id}/metafields`) &&
        request.method() !== "GET"
      ) {
        writes += 1
      }
    })

    await page.goto(`/app/products/${product.id}`)
    const drawer = await openDrawer(page)
    await drawer.getByRole("button", { name: "Save" }).click()

    await expect(drawer).toBeHidden()
    expect(writes).toBe(0)
  })

  test("shows an error with a retry when the values fail to load", async ({
    page,
  }) => {
    const key = uniqueKey("reload")
    await createDefinitionViaApi(page.request, { key, label: `Reload ${key}` })
    const product = await createProductViaApi(page.request, `Reload ${key}`)
    await setProductMetafieldsViaApi(page.request, product.id, [
      { key, value: "Back" },
    ])

    const valuesRequest = `**/admin/products/${product.id}/metafields`
    await page.route(valuesRequest, (route) =>
      route.fulfill({
        status: 500,
        json: { type: "unknown_error", message: "Values are unavailable" },
      })
    )

    await page.goto(`/app/products/${product.id}`)

    const alert = widget(page).getByRole("alert")
    await expect(alert).toContainText("The metafields could not be loaded")
    await expect(alert).toContainText("Values are unavailable")
    await expect(widget(page).getByRole("button", { name: "Edit" })).toHaveCount(0)

    await page.unroute(valuesRequest)
    await alert.getByRole("button", { name: "Retry" }).click()

    await expect(widget(page).getByRole("alert")).toHaveCount(0)
    await expect(fieldRow(page, key)).toContainText("Back")
  })
})
