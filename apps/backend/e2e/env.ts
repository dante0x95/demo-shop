import { loadEnv, MedusaError } from "@medusajs/framework/utils"
import path from "path"

loadEnv("development", path.resolve(__dirname, ".."))

export const E2E_DB_NAME = "medusa_e2e"
export const E2E_PORT = 9001
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`
export const E2E_ADMIN_EMAIL = "e2e-admin@example.com"
export const E2E_ADMIN_PASSWORD = "e2e-supersecret"
export const E2E_AUTH_FILE = path.resolve(__dirname, "../.playwright/auth/admin.json")

// Same server as the dev DATABASE_URL, different database, so the dev data is never touched.
const withDatabase = (url: string, database: string) => {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

const devDatabaseUrl = process.env.DATABASE_URL

if (!devDatabaseUrl) {
  throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "DATABASE_URL must be set in apps/backend/.env to run E2E tests")
}

export const E2E_DATABASE_URL = withDatabase(devDatabaseUrl, E2E_DB_NAME)
export const MAINTENANCE_DATABASE_URL = withDatabase(devDatabaseUrl, "postgres")
