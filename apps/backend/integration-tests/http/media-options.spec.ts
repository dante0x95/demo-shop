import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin-auth"
import { buildMediaForm } from "../helpers/media-form"

jest.setTimeout(60 * 1000)

// Checks that medusa-config.ts passes the MEDIA_* env vars to the media
// module. They are set here rather than through the runner's `env` option,
// which is applied only after medusa-config.ts has been loaded. Jest gives
// each test file its own process.env, so other suites keep the defaults.
process.env.MEDIA_MAX_FILE_SIZE = "20"
process.env.MEDIA_MAX_FILES = "2"
process.env.MEDIA_ALLOWED_MIME_TYPES = "image/png, image/webp"

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("POST /admin/media with env-configured limits", () => {
      it("accepts exactly MEDIA_MAX_FILES files of the allowed types", async () => {
        const form = buildMediaForm([
          { name: "a.png", type: "image/png" },
          { name: "b.webp", type: "image/webp" },
        ])

        const res = await api.post("/admin/media", form, adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data.media_assets).toHaveLength(2)
      })

      it("rejects a type outside MEDIA_ALLOWED_MIME_TYPES", async () => {
        const form = buildMediaForm([{ name: "a.jpg", type: "image/jpeg" }])

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("unsupported type image/jpeg")
      })

      it("rejects more files than MEDIA_MAX_FILES", async () => {
        const form = buildMediaForm([
          { name: "a.png", type: "image/png" },
          { name: "b.png", type: "image/png" },
          { name: "c.png", type: "image/png" },
        ])

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("maximum is 2 per request")
      })

      it("accepts a file of exactly MEDIA_MAX_FILE_SIZE", async () => {
        const form = buildMediaForm([
          {
            name: "a.png",
            type: "image/png",
            content: Buffer.concat([
              Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
              Buffer.alloc(12),
            ]),
          },
        ])

        const res = await api.post("/admin/media", form, adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data.media_assets[0].size).toBe(20)
      })

      it("rejects a file larger than MEDIA_MAX_FILE_SIZE", async () => {
        const form = buildMediaForm([
          {
            name: "a.png",
            type: "image/png",
            content: Buffer.concat([
              Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
              Buffer.alloc(13),
            ]),
          },
        ])

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("maximum size of 20 bytes")
      })
    })
  },
})
