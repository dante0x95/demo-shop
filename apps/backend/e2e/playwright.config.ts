import { defineConfig, devices } from "@playwright/test"
import path from "path"
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  E2E_AUTH_FILE,
  E2E_BASE_URL,
  E2E_DATABASE_URL,
  E2E_DB_NAME,
  E2E_PORT,
  MAINTENANCE_DATABASE_URL,
} from "./env"

export default defineConfig({
  testDir: ".",
  outputDir: "../.playwright/test-results",
  // One worker: all specs share the E2E database and the brands list order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "../.playwright/report", open: "never" }]],
  timeout: 60_000,
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      testMatch: /\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: E2E_AUTH_FILE,
      },
    },
  ],
  webServer: {
    command: `bash e2e/prepare-db.sh && npx medusa develop -p ${E2E_PORT}`,
    cwd: path.resolve(__dirname, ".."),
    url: `${E2E_BASE_URL}/health`,
    // Always start fresh: the database is recreated on every run.
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      MAINTENANCE_DATABASE_URL,
      E2E_DB_NAME,
      E2E_ADMIN_EMAIL,
      E2E_ADMIN_PASSWORD,
      ADMIN_CORS: E2E_BASE_URL,
      AUTH_CORS: E2E_BASE_URL,
    },
  },
})
