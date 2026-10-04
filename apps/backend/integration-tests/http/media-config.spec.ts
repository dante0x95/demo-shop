import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin-auth"
import { buildMediaForm } from "../helpers/media-form"

jest.setTimeout(60 * 1000)

// Runs with the media module's defaults and no FILE_BACKEND_URL; the
// env-configured values are covered in media-options.spec.ts.
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("GET /admin/media/config", () => {
      it("returns the media module's default limits", async () => {
        const res = await api.get("/admin/media/config", adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          config: {
            allowed_mime_types: [
              "image/jpeg",
              "image/png",
              "image/gif",
              "image/webp",
              "image/avif",
            ],
            max_file_size: 5 * 1024 * 1024,
            max_files: 10,
          },
        })
      })

      it("requires an admin session", async () => {
        const res = await api
          .get("/admin/media/config")
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("file URLs without FILE_BACKEND_URL", () => {
      it("keep the local file provider's default base URL", async () => {
        const form = buildMediaForm([{ name: "a.png", type: "image/png" }])

        const res = await api.post("/admin/media", form, adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data.media_assets[0].url).toMatch(
          /^http:\/\/localhost:9000\/static\/.+-a\.png$/
        )
      })
    })
  },
})
