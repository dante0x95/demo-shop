import {
  APIRequestContext,
  expect,
  Locator,
  Page,
  test,
} from "@playwright/test"
import { execFileSync } from "child_process"
import path from "path"
import { E2E_DATABASE_URL } from "../env"
import { ORDER_ID_MARKER } from "../fixtures/order-id-marker"

type Driver = {
  id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
}

type OrderState = "pending" | "canceled" | "delivered"

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

// No storefront checkout in E2E, so orders come from a fixture script.
const createOrder = (state: OrderState = "pending"): string => {
  const output = execFileSync(
    "npx",
    [
      "medusa",
      "exec",
      "./e2e/fixtures/create-order.ts",
      `buyer-${suffix()}@example.com`,
      state,
    ],
    {
      cwd: path.resolve(__dirname, "../.."),
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
      stdio: "pipe",
      encoding: "utf-8",
    }
  )

  const line = output
    .split("\n")
    .find((l) => l.trim().startsWith(ORDER_ID_MARKER))

  if (!line) {
    throw new Error(`create-order fixture printed no order id:\n${output}`)
  }

  return line.trim().slice(ORDER_ID_MARKER.length)
}

// Unique first names: the picker lists drivers by name and email.
const createDriverViaApi = async (
  request: APIRequestContext,
  data: Record<string, unknown> = {}
): Promise<Driver> => {
  const res = await request.post("/admin/drivers", {
    data: {
      first_name: `Driver${suffix()}`,
      last_name: "Lopez",
      email: `driver-${suffix()}@example.com`,
      phone: "+52 55 1234 5678",
      vehicle_type: "motorcycle",
      is_active: true,
      ...data,
    },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).driver
}

const assignViaApi = async (
  request: APIRequestContext,
  orderId: string,
  driverId: string
) =>
  request.post(`/admin/orders/${orderId}/assign-driver`, {
    data: { driver_id: driverId },
  })

const orderDriverViaApi = async (request: APIRequestContext, orderId: string) => {
  const res = await request.get(`/admin/orders/${orderId}`, {
    params: { fields: "id,display_id,driver.id" },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).order as {
    display_id: number
    driver: { id: string } | null
  }
}

// The error the modal shows must be the API's own 400 message.
const apiAssignErrorMessage = async (
  request: APIRequestContext,
  orderId: string,
  driverId: string
) => {
  const res = await assignViaApi(request, orderId, driverId)
  expect(res.status()).toBe(400)
  return (await res.json()).message as string
}

const fullName = (driver: Driver) => `${driver.first_name} ${driver.last_name}`

const openOrder = async (page: Page, orderId: string) => {
  await page.goto(`/app/orders/${orderId}`)
  const widget = page.getByTestId("order-driver-widget")
  await expect(widget.getByRole("heading", { name: "Driver" })).toBeVisible()
  return widget
}

const openPicker = async (page: Page, widget: Locator, button: string) => {
  await widget.getByRole("button", { name: button }).click()
  const modal = page.getByRole("dialog")
  await expect(modal.getByRole("heading", { name: button })).toBeVisible()
  return modal
}

const pickerRow = (modal: Locator, driver: Driver) =>
  modal.getByRole("row").filter({ hasText: driver.email })

const filterPicker = async (page: Page, label: string, value: string) => {
  const listed = page.waitForResponse(
    (res) =>
      res.url().includes("/admin/drivers?") &&
      new URL(res.url()).searchParams.get("is_active") === value
  )
  await page.getByRole("combobox", { name: "Driver status" }).click()
  await page.getByRole("option", { name: label, exact: true }).click()
  await listed
}

const assignFromPicker = async (page: Page, modal: Locator, driver: Driver) => {
  const assigned = page.waitForResponse(
    (res) =>
      res.url().includes("/assign-driver") && res.request().method() === "POST"
  )
  await pickerRow(modal, driver).getByRole("button", { name: "Assign" }).click()
  return assigned
}

test.describe("Order page driver widget", () => {
  test("shows an order without a driver as pending delivery", async ({
    page,
  }) => {
    const orderId = createOrder()

    const widget = await openOrder(page, orderId)

    await expect(widget).toContainText("No driver assigned")
    await expect(widget).toContainText("Pending delivery")
    await expect(
      widget.getByRole("button", { name: "Assign driver" })
    ).toBeVisible()
  })

  test("assigns an active driver picked from the list", async ({ page }) => {
    const orderId = createOrder()
    const driver = await createDriverViaApi(page.request, {
      vehicle_type: "car",
    })
    const { display_id } = await orderDriverViaApi(page.request, orderId)

    const widget = await openOrder(page, orderId)
    const modal = await openPicker(page, widget, "Assign driver")

    const row = pickerRow(modal, driver)
    await expect(row).toContainText(fullName(driver))
    await expect(row).toContainText("Car")
    await expect(row).toContainText("Active")

    const response = await assignFromPicker(page, modal, driver)
    expect(response.status()).toBe(200)

    await expect(
      page.getByText(`${fullName(driver)} will deliver order #${display_id}`)
    ).toBeVisible()
    await expect(modal).toBeHidden()
    await expect(widget).toContainText(fullName(driver))
    await expect(widget).toContainText("+52 55 1234 5678")
    await expect(widget).toContainText("Car")
    await expect(widget).toContainText("Pending delivery")
    await expect(
      widget.getByRole("button", { name: "Change driver" })
    ).toBeVisible()

    // Survives a reload, so the widget reads the link from the server.
    await page.reload()
    await expect(page.getByTestId("order-driver-widget")).toContainText(
      fullName(driver)
    )
    expect((await orderDriverViaApi(page.request, orderId)).driver?.id).toBe(
      driver.id
    )
  })

  test("changes the driver and marks the current one as assigned", async ({
    page,
  }) => {
    const orderId = createOrder()
    const current = await createDriverViaApi(page.request)
    const next = await createDriverViaApi(page.request)
    expect((await assignViaApi(page.request, orderId, current.id)).status()).toBe(
      200
    )

    const widget = await openOrder(page, orderId)
    await expect(widget).toContainText(fullName(current))

    const modal = await openPicker(page, widget, "Change driver")
    await expect(
      pickerRow(modal, current).getByRole("button", { name: "Assigned" })
    ).toBeDisabled()

    const response = await assignFromPicker(page, modal, next)
    expect(response.status()).toBe(200)

    await expect(modal).toBeHidden()
    await expect(widget).toContainText(fullName(next))
    await expect(widget).not.toContainText(fullName(current))
    expect((await orderDriverViaApi(page.request, orderId)).driver?.id).toBe(
      next.id
    )
  })

  test("lists active drivers first and inactive ones behind the filter", async ({
    page,
  }) => {
    const orderId = createOrder()
    const active = await createDriverViaApi(page.request)
    const inactive = await createDriverViaApi(page.request, {
      is_active: false,
    })

    const widget = await openOrder(page, orderId)
    const modal = await openPicker(page, widget, "Assign driver")

    await expect(pickerRow(modal, active)).toBeVisible()
    await expect(pickerRow(modal, inactive)).toHaveCount(0)

    await filterPicker(page, "Inactive", "false")
    await expect(pickerRow(modal, inactive)).toContainText("Inactive")
    await expect(pickerRow(modal, active)).toHaveCount(0)
  })

  test("shows the API error for an inactive driver and keeps the order unassigned", async ({
    page,
  }) => {
    const orderId = createOrder()
    const inactive = await createDriverViaApi(page.request, {
      is_active: false,
    })
    const message = await apiAssignErrorMessage(
      page.request,
      orderId,
      inactive.id
    )

    const widget = await openOrder(page, orderId)
    const modal = await openPicker(page, widget, "Assign driver")
    await filterPicker(page, "Inactive", "false")

    const response = await assignFromPicker(page, modal, inactive)
    expect(response.status()).toBe(400)

    await expect(modal.getByRole("alert")).toHaveText(message)
    await expect(modal).toBeVisible()

    await modal.getByRole("button", { name: "Cancel" }).click()
    await expect(modal).toBeHidden()
    await expect(widget).toContainText("No driver assigned")
  })

  test("shows the API error for a canceled order", async ({ page }) => {
    const orderId = createOrder("canceled")
    const driver = await createDriverViaApi(page.request)
    const message = await apiAssignErrorMessage(
      page.request,
      orderId,
      driver.id
    )

    const widget = await openOrder(page, orderId)
    const modal = await openPicker(page, widget, "Assign driver")
    const response = await assignFromPicker(page, modal, driver)
    expect(response.status()).toBe(400)

    await expect(modal.getByRole("alert")).toHaveText(message)
    expect(message).toContain("canceled")
  })

  test("shows a delivered order and the API error when changing its driver", async ({
    page,
  }) => {
    const orderId = createOrder("delivered")
    const driver = await createDriverViaApi(page.request)
    const message = await apiAssignErrorMessage(
      page.request,
      orderId,
      driver.id
    )

    const widget = await openOrder(page, orderId)
    await expect(widget).toContainText("Delivered")
    await expect(widget).not.toContainText("Pending delivery")

    const modal = await openPicker(page, widget, "Assign driver")
    const response = await assignFromPicker(page, modal, driver)
    expect(response.status()).toBe(400)

    await expect(modal.getByRole("alert")).toHaveText(message)
    expect(message).toContain("already delivered")
  })

  test("shows an error with a retry when the driver fails to load", async ({
    page,
  }) => {
    const orderId = createOrder()
    const driver = await createDriverViaApi(page.request)
    expect((await assignViaApi(page.request, orderId, driver.id)).status()).toBe(
      200
    )

    // Only the widget's request asks for the driver.
    const widgetRequest = (url: URL) =>
      url.pathname.endsWith(`/admin/orders/${orderId}`) &&
      (url.searchParams.get("fields") ?? "").includes("driver.id")
    await page.route(widgetRequest, (route) =>
      route.fulfill({
        status: 500,
        json: { type: "unknown_error", message: "Drivers are unavailable" },
      })
    )

    await page.goto(`/app/orders/${orderId}`)
    const widget = page.getByTestId("order-driver-widget")
    const alert = widget.getByRole("alert")
    await expect(alert).toContainText("The driver could not be loaded", {
      timeout: 15_000,
    })
    await expect(alert).toContainText("Drivers are unavailable")

    await page.unroute(widgetRequest)
    await alert.getByRole("button", { name: "Retry" }).click()

    await expect(widget.getByRole("alert")).toHaveCount(0)
    await expect(widget).toContainText(fullName(driver))
  })
})
