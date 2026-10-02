import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from "../../src/modules/media"
import MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin-auth"

jest.setTimeout(60 * 1000)

type SeedAsset = {
  filename: string
  mime_type?: string
  alt?: string | null
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    // Creates the assets one at a time so each gets a later `created_at`.
    const seedAssets = async (assets: SeedAsset[]) => {
      const mediaModuleService: MediaModuleService =
        getContainer().resolve(MEDIA_MODULE)

      const created: { id: string; filename: string }[] = []

      for (const asset of assets) {
        const [mediaAsset] = await mediaModuleService.createMediaAssets([
          {
            url: `http://localhost/static/${asset.filename}`,
            file_id: asset.filename,
            filename: asset.filename,
            mime_type: asset.mime_type ?? "image/png",
            size: 100,
            alt: asset.alt ?? null,
          },
        ])
        created.push(mediaAsset)
        await new Promise((resolve) => setTimeout(resolve, 5))
      }

      return created
    }

    const filenames = (res: { data: { media_assets: { filename: string }[] } }) =>
      res.data.media_assets.map((asset) => asset.filename)

    describe("GET /admin/media", () => {
      it("lists media assets newest first with pagination metadata", async () => {
        await seedAssets([
          { filename: "first.png", alt: "First" },
          { filename: "second.png" },
          { filename: "third.png" },
        ])

        const res = await api.get("/admin/media", adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          media_assets: [
            expect.objectContaining({ filename: "third.png" }),
            expect.objectContaining({ filename: "second.png" }),
            expect.objectContaining({
              id: expect.stringMatching(/^media_/),
              url: "http://localhost/static/first.png",
              file_id: "first.png",
              filename: "first.png",
              mime_type: "image/png",
              size: 100,
              alt: "First",
              metadata: null,
              created_at: expect.any(String),
              updated_at: expect.any(String),
            }),
          ],
          count: 3,
          offset: 0,
          limit: 20,
        })
      })

      it("paginates with limit and offset", async () => {
        await seedAssets([
          { filename: "a.png" },
          { filename: "b.png" },
          { filename: "c.png" },
          { filename: "d.png" },
          { filename: "e.png" },
        ])

        const res = await api.get("/admin/media?limit=2&offset=2", adminHeaders)

        expect(res.status).toBe(200)
        expect(filenames(res)).toEqual(["c.png", "b.png"])
        expect(res.data.count).toBe(5)
        expect(res.data.offset).toBe(2)
        expect(res.data.limit).toBe(2)
      })

      it("orders assets that share created_at by id so pages are stable", async () => {
        const mediaModuleService: MediaModuleService =
          getContainer().resolve(MEDIA_MODULE)

        // One call, like an upload request: the rows share `created_at`.
        const created = await mediaModuleService.createMediaAssets(
          ["a", "b", "c", "d", "e", "f"].map((name) => ({
            url: `http://localhost/static/${name}.png`,
            file_id: `${name}.png`,
            filename: `${name}.png`,
            mime_type: "image/png",
            size: 100,
          }))
        )

        expect(
          new Set(created.map((asset) => new Date(asset.created_at).getTime()))
            .size
        ).toBe(1)

        const pages = await Promise.all(
          [0, 2, 4].map((offset) =>
            api.get(`/admin/media?limit=2&offset=${offset}`, adminHeaders)
          )
        )
        const ids = pages.flatMap((page) =>
          page.data.media_assets.map((asset: { id: string }) => asset.id)
        )
        const expected = created
          .map((asset) => asset.id)
          .sort()
          .reverse()

        expect(ids).toEqual(expected)
      })

      it("filters by q on alt or filename, ignoring case", async () => {
        await seedAssets([
          { filename: "summer-dress.png" },
          { filename: "img-001.png", alt: "Red SUMMER hat" },
          { filename: "winter-coat.png", alt: "Coat" },
        ])

        const res = await api.get("/admin/media?q=summer", adminHeaders)

        expect(res.status).toBe(200)
        expect(filenames(res)).toEqual(["img-001.png", "summer-dress.png"])
        expect(res.data.count).toBe(2)
      })

      it("matches LIKE wildcards in q literally", async () => {
        await seedAssets([
          { filename: "plain.png", alt: "No discount" },
          { filename: "sale.png", alt: "50% off" },
        ])

        const res = await api.get(
          `/admin/media?q=${encodeURIComponent("%")}`,
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(filenames(res)).toEqual(["sale.png"])
      })

      it("filters by one or more mime types", async () => {
        await seedAssets([
          { filename: "a.png", mime_type: "image/png" },
          { filename: "b.jpg", mime_type: "image/jpeg" },
          { filename: "c.webp", mime_type: "image/webp" },
        ])

        const single = await api.get(
          "/admin/media?mime_type=image/jpeg",
          adminHeaders
        )

        expect(single.status).toBe(200)
        expect(filenames(single)).toEqual(["b.jpg"])

        const multiple = await api.get(
          "/admin/media?mime_type=image/png&mime_type=image/webp",
          adminHeaders
        )

        expect(multiple.status).toBe(200)
        expect(filenames(multiple)).toEqual(["c.webp", "a.png"])
        expect(multiple.data.count).toBe(2)
      })

      it("combines q and mime_type", async () => {
        await seedAssets([
          { filename: "logo.png", mime_type: "image/png" },
          { filename: "logo.jpg", mime_type: "image/jpeg" },
          { filename: "banner.png", mime_type: "image/png" },
        ])

        const res = await api.get(
          "/admin/media?q=logo&mime_type=image/png",
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(filenames(res)).toEqual(["logo.png"])
      })

      it("returns 400 for an unknown query param", async () => {
        const res = await api
          .get("/admin/media?unknown=1", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 for with_deleted", async () => {
        const res = await api
          .get("/admin/media?with_deleted=true", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 for a non-numeric limit", async () => {
        const res = await api
          .get("/admin/media?limit=abc", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 for an empty q", async () => {
        const res = await api
          .get("/admin/media?q=%20", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 401 without authentication", async () => {
        const res = await api.get("/admin/media").catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })
  },
})
