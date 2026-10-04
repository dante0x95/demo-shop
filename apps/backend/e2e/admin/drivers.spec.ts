import {
  APIRequestContext,
  expect,
  Page,
  request as playwrightRequest,
  test,
} from "@playwright/test"
import { E2E_BASE_URL } from "../env"

type Driver = {
  id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
}

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const uniqueEmail = (label: string) => `${label}-${suffix()}@example.com`

const VALID_BODY = {
  first_name: "Ana",
  last_name: "Lopez",
  phone: "+52 55 1234 5678",
  vehicle_type: "motorcycle",
}

const createViaApi = async (
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<Driver> => {
  const res = await request.post("/admin/drivers", {
    data: { ...VALID_BODY, email: uniqueEmail("driver"), ...data },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).driver
}

const listViaApi = async (
  request: APIRequestContext,
  params: Record<string, string | number>
) => {
  const res = await request.get("/admin/drivers", { params })
  expect(res.status()).toBe(200)
  return (await res.json()) as { drivers: Driver[]; count: number }
}

// A self-registered driver: they already have a login, so no invitation.
const registerViaApi = async (email: string): Promise<Driver> => {
  const context = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })

  try {
    const registerRes = await context.post(
      "/auth/driver/emailpass/register",
      { data: { email, password: "secret123" } }
    )
    expect(registerRes.status()).toBe(200)
    const { token } = await registerRes.json()

    const driverRes = await context.post("/drivers", {
      data: VALID_BODY,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(driverRes.status()).toBe(200)
    return (await driverRes.json()).driver
  } finally {
    await context.dispose()
  }
}

const rowFor = (page: Page, text: string) =>
  page.getByRole("row").filter({ hasText: text })

const openRowMenu = async (page: Page, text: string) => {
  await rowFor(page, text).getByRole("button").click()
}

const openCreateModal = async (page: Page) => {
  if (!page.url().endsWith("/app/drivers")) {
    await page.goto("/app/drivers")
  }
  await page.getByRole("button", { name: "Create driver" }).click()
  const modal = page.getByRole("dialog")
  await expect(modal.getByRole("heading", { name: "Create driver" })).toBeVisible()
  return modal
}

const pickOption = async (page: Page, combobox: string, option: string) => {
  await page.getByRole("combobox", { name: combobox }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

const filterByStatus = async (page: Page, label: string, value: string) => {
  const listed = page.waitForResponse(
    (res) =>
      res.url().includes("/admin/drivers?") &&
      new URL(res.url()).searchParams.get("is_active") === value
  )
  await pickOption(page, "Status", label)
  await listed
}

test.describe("Admin drivers page", () => {
  test("is reachable from the sidebar and lists drivers", async ({ page }) => {
    const driver = await createViaApi(page.request, {
      first_name: "Listed",
      last_name: "Driver",
      vehicle_type: "car",
      license_plate: "ABC 123",
      is_active: true,
    })

    await page.goto("/app")
    await page.getByRole("link", { name: "Drivers" }).click()

    await expect(page).toHaveURL(/\/app\/drivers$/)
    await expect(page.getByRole("heading", { name: "Drivers" })).toBeVisible()
    for (const header of [
      "Name",
      "Email",
      "Phone",
      "Vehicle",
      "License plate",
      "Status",
    ]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible()
    }

    const row = rowFor(page, driver.email)
    await expect(row).toContainText("Listed Driver")
    await expect(row).toContainText("+52 55 1234 5678")
    await expect(row).toContainText("Car")
    await expect(row).toContainText("ABC 123")
    await expect(row).toContainText("Active")
  })

  test("creates a driver, sends the invitation and shows it first", async ({
    page,
  }) => {
    const email = uniqueEmail("created")
    const modal = await openCreateModal(page)

    await modal.getByLabel("First name").fill("Carla")
    await modal.getByLabel("Last name").fill("Gomez")
    await modal.getByLabel("Email").fill(email)
    await modal.getByLabel("Phone").fill("5512345678")
    await pickOption(page, "Vehicle type", "Bicycle")
    await modal.getByLabel("Active").click()

    const created = page.waitForResponse(
      (res) =>
        res.url().endsWith("/admin/drivers") &&
        res.request().method() === "POST"
    )
    await modal.getByRole("button", { name: "Save" }).click()
    const response = await created
    expect(response.status()).toBe(200)
    const { driver } = await response.json()

    await expect(
      page.getByText(
        `Driver "Carla Gomez" created. Invitation sent to ${email}`
      )
    ).toBeVisible()
    await expect(modal).toBeHidden()

    const firstRow = page.getByRole("row").nth(1)
    await expect(firstRow).toContainText(email)
    await expect(firstRow).toContainText("Bicycle")
    await expect(firstRow).toContainText("Active")

    // Survives a reload, so the row comes from the server.
    await page.reload()
    await expect(rowFor(page, email)).toBeVisible()

    const { drivers } = await listViaApi(page.request, { limit: 100 })
    expect(drivers.find((d) => d.id === driver.id)).toMatchObject({
      first_name: "Carla",
      last_name: "Gomez",
      email,
      phone: "5512345678",
      vehicle_type: "bicycle",
      license_plate: null,
      is_active: true,
    })
  })

  test("creates an inactive driver with a license plate by default", async ({
    page,
  }) => {
    const email = uniqueEmail("inactive")
    const modal = await openCreateModal(page)

    await modal.getByLabel("First name").fill("Ivan")
    await modal.getByLabel("Last name").fill("Ruiz")
    await modal.getByLabel("Email").fill(email)
    await modal.getByLabel("Phone").fill("5500000000")
    await pickOption(page, "Vehicle type", "Motorcycle")
    await modal.getByLabel("License plate (optional)").fill("XYZ 987")
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal).toBeHidden()
    const row = rowFor(page, email)
    await expect(row).toContainText("XYZ 987")
    await expect(row).toContainText("Inactive")
  })

  test("shows the new driver on page 1 when created from a later page", async ({
    page,
  }) => {
    // 21 drivers so the list has a second page.
    for (let i = 0; i < 21; i++) {
      await createViaApi(page.request, {})
    }

    await page.goto("/app/drivers")
    await page.getByRole("button", { name: "Next" }).click()
    await expect(page.getByRole("button", { name: "Prev" })).toBeEnabled()

    const email = uniqueEmail("from-page-2")
    const modal = await openCreateModal(page)
    await modal.getByLabel("First name").fill("Paula")
    await modal.getByLabel("Last name").fill("Second")
    await modal.getByLabel("Email").fill(email)
    await modal.getByLabel("Phone").fill("5522222222")
    await pickOption(page, "Vehicle type", "Car")
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal).toBeHidden()
    await expect(page.getByRole("button", { name: "Prev" })).toBeDisabled()
    await expect(page.getByRole("row").nth(1)).toContainText(email)
  })

  test("shows the API error for missing fields", async ({ page }) => {
    // Same payload the form sends when nothing is filled in.
    const apiRes = await page.request.post("/admin/drivers", {
      data: {
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        is_active: false,
      },
    })
    expect(apiRes.status()).toBe(400)
    const { message } = await apiRes.json()

    const modal = await openCreateModal(page)
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(modal.getByText(message)).toBeVisible()
    await expect(modal).toBeVisible()
  })

  test("shows the API error for a duplicate email", async ({ page }) => {
    const existing = await createViaApi(page.request, {})
    const modal = await openCreateModal(page)

    await modal.getByLabel("First name").fill("Dup")
    await modal.getByLabel("Last name").fill("Licate")
    await modal.getByLabel("Email").fill(existing.email)
    await modal.getByLabel("Phone").fill("5511111111")
    await pickOption(page, "Vehicle type", "Car")
    await modal.getByRole("button", { name: "Save" }).click()

    await expect(
      modal.getByText("A driver with this email already exists")
    ).toBeVisible()
    await expect(modal).toBeVisible()
  })

  test("filters drivers by status", async ({ page }) => {
    const active = await createViaApi(page.request, { is_active: true })
    const inactive = await createViaApi(page.request, { is_active: false })

    await page.goto("/app/drivers")
    await expect(rowFor(page, active.email)).toBeVisible()
    await expect(rowFor(page, inactive.email)).toBeVisible()

    await filterByStatus(page, "Inactive", "false")
    await expect(rowFor(page, inactive.email)).toBeVisible()
    await expect(rowFor(page, active.email)).toHaveCount(0)
    await expect(
      page.getByRole("row").filter({ hasText: /\bActive\b/ })
    ).toHaveCount(0)

    await filterByStatus(page, "Active", "true")
    await expect(rowFor(page, active.email)).toBeVisible()
    await expect(rowFor(page, inactive.email)).toHaveCount(0)
    await expect(
      page.getByRole("row").filter({ hasText: "Inactive" })
    ).toHaveCount(0)

    // The unfiltered page is still cached, so this may not hit the API.
    await pickOption(page, "Status", "All statuses")
    await expect(rowFor(page, active.email)).toBeVisible()
    await expect(rowFor(page, inactive.email)).toBeVisible()
  })

  test("goes back to the first page when the status filter changes", async ({
    page,
  }) => {
    // 21 active drivers so the unfiltered list has a second page.
    for (let i = 0; i < 21; i++) {
      await createViaApi(page.request, { is_active: true })
    }

    await page.goto("/app/drivers")
    await page.getByRole("button", { name: "Next" }).click()
    await expect(page.getByRole("button", { name: "Prev" })).toBeEnabled()

    const firstPage = page.waitForResponse(
      (res) =>
        res.url().includes("/admin/drivers?") &&
        new URL(res.url()).searchParams.get("is_active") === "true" &&
        new URL(res.url()).searchParams.get("offset") === "0"
    )
    await pickOption(page, "Status", "Active")
    await firstPage

    await expect(page.getByRole("button", { name: "Prev" })).toBeDisabled()
  })

  test("resends the invitation after confirming", async ({ page }) => {
    const driver = await createViaApi(page.request, {})

    await page.goto("/app/drivers")
    await openRowMenu(page, driver.email)
    await page.getByRole("menuitem", { name: "Resend invitation" }).click()

    const prompt = page.getByRole("alertdialog")
    await expect(prompt.getByText("Resend invitation?")).toBeVisible()
    await expect(prompt).toContainText(
      `A new link to set a password is emailed to ${driver.email}. The previous link stops working.`
    )

    const resent = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/admin/drivers/${driver.id}/resend-invite`) &&
        res.request().method() === "POST"
    )
    await prompt.getByRole("button", { name: "Resend" }).click()
    expect((await resent).status()).toBe(201)

    await expect(
      page.getByText(`Invitation sent to ${driver.email}`)
    ).toBeVisible()
  })

  test("does not resend when the prompt is cancelled", async ({ page }) => {
    const driver = await createViaApi(page.request, {})
    let resendCalls = 0
    page.on("request", (req) => {
      if (req.url().endsWith(`/admin/drivers/${driver.id}/resend-invite`)) {
        resendCalls++
      }
    })

    await page.goto("/app/drivers")
    await openRowMenu(page, driver.email)
    await page.getByRole("menuitem", { name: "Resend invitation" }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancel" })
      .click()

    await expect(page.getByRole("alertdialog")).toBeHidden()
    expect(resendCalls).toBe(0)
  })

  test("shows the API error when the driver already has a login", async ({
    page,
  }) => {
    const driver = await registerViaApi(uniqueEmail("self-registered"))

    await page.goto("/app/drivers")
    await openRowMenu(page, driver.email)
    await page.getByRole("menuitem", { name: "Resend invitation" }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Resend" })
      .click()

    await expect(page.getByText("This driver already has a login")).toBeVisible()
  })

  test("paginates 20 drivers per page, newest first", async ({ page }) => {
    const prefix = `page-${suffix()}`
    const emails = Array.from(
      { length: 21 },
      (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}@example.com`
    )

    // Sequential so created_at follows the array order.
    for (const email of emails) {
      await createViaApi(page.request, { email })
    }

    await page.goto("/app/drivers")

    // Newest first: drivers 21..02 fill page 1, driver 01 moves to page 2.
    await expect(page.getByRole("row")).toHaveCount(21)
    await expect(page.getByRole("row").nth(1)).toContainText(emails[20])
    await expect(rowFor(page, emails[0])).toHaveCount(0)

    await page.getByRole("button", { name: "Next" }).click()

    await expect(page.getByRole("row").nth(1)).toContainText(emails[0])
  })

  test("shows an error with a retry when the list fails to load", async ({
    page,
  }) => {
    const driver = await createViaApi(page.request, {})

    const listRequest = /\/admin\/drivers\?/
    await page.route(listRequest, (route) =>
      route.fulfill({
        status: 500,
        json: { type: "unknown_error", message: "Drivers are unavailable" },
      })
    )

    await page.goto("/app/drivers")

    const alert = page.getByRole("alert")
    await expect(alert).toContainText("The drivers could not be loaded")
    await expect(alert).toContainText("Drivers are unavailable")
    await expect(page.getByRole("table")).toHaveCount(0)

    await page.unroute(listRequest)
    await alert.getByRole("button", { name: "Retry" }).click()

    await expect(page.getByRole("alert")).toHaveCount(0)
    await expect(rowFor(page, driver.email)).toBeVisible()
  })
})

test.describe("Admin drivers page without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("redirects to login", async ({ page }) => {
    await page.goto("/app/drivers")

    await expect(page).toHaveURL(/\/app\/login/)
  })
})
