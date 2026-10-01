import { expect, test as setup } from "@playwright/test"
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_AUTH_FILE } from "./env"

setup("log in as admin", async ({ page }) => {
  await page.goto("/app/login")
  await page.locator('input[name="email"]').fill(E2E_ADMIN_EMAIL)
  await page.locator('input[name="password"]').fill(E2E_ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Continue with Email" }).click()

  await expect(page).not.toHaveURL(/\/login/)

  await page.context().storageState({ path: E2E_AUTH_FILE })
})
