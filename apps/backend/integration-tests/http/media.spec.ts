import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { MEDIA_MODULE } from "../../src/modules/media"
import MediaModuleService from "../../src/modules/media/service"
import {
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_FILES,
} from "../../src/modules/media/utils/options"
import { createAdminUser } from "../helpers/admin-auth"
import { buildMediaForm as buildForm, imageContent } from "../helpers/media-form"

jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const countMediaAssets = async () => {
      const mediaModuleService: MediaModuleService =
        getContainer().resolve(MEDIA_MODULE)

      const [, count] = await mediaModuleService.listAndCountMediaAssets()

      return count
    }

    describe("POST /admin/media", () => {
      it("uploads two images and registers a media asset for each", async () => {
        const form = buildForm(
          [
            { name: "front.png", type: "image/png" },
            { name: "back.jpg", type: "image/jpeg" },
          ],
          ["Front view"]
        )

        const res = await api.post("/admin/media", form, adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data.media_assets).toEqual([
          expect.objectContaining({
            id: expect.stringMatching(/^media_/),
            url: expect.any(String),
            file_id: expect.any(String),
            filename: "front.png",
            mime_type: "image/png",
            size: imageContent("image/png").length,
            alt: "Front view",
          }),
          expect.objectContaining({
            id: expect.stringMatching(/^media_/),
            url: expect.any(String),
            file_id: expect.any(String),
            filename: "back.jpg",
            mime_type: "image/jpeg",
            size: imageContent("image/jpeg").length,
            alt: null,
          }),
        ])

        const mediaModuleService: MediaModuleService =
          getContainer().resolve(MEDIA_MODULE)
        const persisted = await mediaModuleService.listMediaAssets({
          id: res.data.media_assets.map((asset: { id: string }) => asset.id),
        })

        expect(persisted).toHaveLength(2)
      })

      it("returns 400 for a non-image file and creates nothing", async () => {
        const form = buildForm([
          { name: "front.png", type: "image/png" },
          { name: "notes.txt", type: "text/plain" },
        ])

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("notes.txt")
        expect(await countMediaAssets()).toBe(0)
      })

      it("returns 400 for an SVG image", async () => {
        const form = buildForm([{ name: "logo.svg", type: "image/svg+xml" }])

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(await countMediaAssets()).toBe(0)
      })

      it("returns 400 when a file exceeds the maximum size", async () => {
        const form = buildForm([
          {
            name: "huge.png",
            type: "image/png",
            content: Buffer.alloc(DEFAULT_MAX_FILE_SIZE + 1),
          },
        ])

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("maximum size")
        expect(await countMediaAssets()).toBe(0)
      })

      it("returns 400 when the extension does not match the type", async () => {
        const form = buildForm([
          {
            name: "evil.html",
            type: "image/png",
            content: imageContent("image/png"),
          },
        ])

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("extension")
        expect(await countMediaAssets()).toBe(0)
      })

      it("returns 400 when the content is not the declared image type", async () => {
        const form = buildForm([
          {
            name: "fake.png",
            type: "image/png",
            content: Buffer.from("<script>alert(1)</script>"),
          },
        ])

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain("not a valid image/png image")
        expect(await countMediaAssets()).toBe(0)
      })

      it("returns 400 when a file has the signature of another image type", async () => {
        const form = buildForm([
          {
            name: "photo.png",
            type: "image/png",
            content: imageContent("image/jpeg"),
          },
        ])

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(await countMediaAssets()).toBe(0)
      })

      it("accepts every supported image type", async () => {
        const form = buildForm([
          { name: "a.jpeg", type: "image/jpeg" },
          { name: "b.PNG", type: "image/png" },
          { name: "c.gif", type: "image/gif" },
          { name: "d.webp", type: "image/webp" },
          { name: "e.avif", type: "image/avif" },
        ])

        const res = await api.post("/admin/media", form, adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data.media_assets).toHaveLength(5)
      })

      it("returns 400 when more files than the maximum are sent", async () => {
        const form = buildForm(
          Array.from({ length: DEFAULT_MAX_FILES + 1 }, (_, index) => ({
            name: `photo-${index}.png`,
            type: "image/png",
          }))
        )

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain(
          `maximum is ${DEFAULT_MAX_FILES} per request`
        )
        expect(await countMediaAssets()).toBe(0)
      })

      it("returns 400 when no files are sent", async () => {
        const res = await api
          .post("/admin/media", buildForm([]), adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("No files were uploaded")
      })

      it("returns 400 for an unknown multipart field", async () => {
        const form = buildForm([{ name: "front.png", type: "image/png" }])
        form.append("unknown", "value")

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(await countMediaAssets()).toBe(0)
      })

      it("deletes the uploaded files when registering the assets fails", async () => {
        const container = getContainer()
        const mediaModuleService: MediaModuleService =
          container.resolve(MEDIA_MODULE)
        const fileModuleService = container.resolve(Modules.FILE)

        jest
          .spyOn(mediaModuleService, "createMediaAssets")
          .mockRejectedValueOnce(new Error("database unavailable"))
        const createFilesSpy = jest.spyOn(fileModuleService, "createFiles")
        const deleteFilesSpy = jest.spyOn(fileModuleService, "deleteFiles")

        const res = await api
          .post(
            "/admin/media",
            buildForm([{ name: "front.png", type: "image/png" }]),
            adminHeaders
          )
          .catch((e) => e.response)

        expect(res.status).toBe(500)

        const createdFile = await createFilesSpy.mock.results[0].value
        expect(deleteFilesSpy).toHaveBeenCalledWith([createdFile.id])
        expect(await countMediaAssets()).toBe(0)
      })

      it("deletes the files that uploaded when another upload fails", async () => {
        const fileModuleService = getContainer().resolve(Modules.FILE)
        const createFiles = fileModuleService.createFiles.bind(fileModuleService)

        const createFilesSpy = jest
          .spyOn(fileModuleService, "createFiles")
          .mockImplementationOnce(createFiles)
          .mockRejectedValueOnce(new Error("storage unavailable"))
        const deleteFilesSpy = jest.spyOn(fileModuleService, "deleteFiles")

        const res = await api
          .post(
            "/admin/media",
            buildForm([
              { name: "front.png", type: "image/png" },
              { name: "back.png", type: "image/png" },
            ]),
            adminHeaders
          )
          .catch((e) => e.response)

        expect(res.status).toBe(500)
        expect(createFilesSpy).toHaveBeenCalledTimes(2)

        const uploadedFile = await createFilesSpy.mock.results[0].value
        expect(deleteFilesSpy).toHaveBeenCalledTimes(1)
        expect(deleteFilesSpy).toHaveBeenCalledWith([uploadedFile.id])
        expect(await countMediaAssets()).toBe(0)
      })

      it("stores the exact bytes that were uploaded", async () => {
        // Bytes that are not valid UTF-8 catch any text re-encoding.
        const content = Buffer.concat([
          imageContent("image/png"),
          Buffer.from([0x00, 0xff, 0xfe, 0x80, 0xc3, 0x28, 0x0d, 0x0a]),
        ])

        const res = await api.post(
          "/admin/media",
          buildForm([{ name: "bytes.png", type: "image/png", content }]),
          adminHeaders
        )

        const [mediaAsset] = res.data.media_assets
        const stored = await api.get(new URL(mediaAsset.url).pathname, {
          responseType: "arraybuffer",
        })

        expect(mediaAsset.size).toBe(content.length)
        expect(Buffer.from(stored.data).equals(content)).toBe(true)
      })

      it("accepts a file of exactly the maximum size", async () => {
        const signature = imageContent("image/png")
        const content = Buffer.concat([
          signature,
          Buffer.alloc(DEFAULT_MAX_FILE_SIZE - signature.length),
        ])

        const res = await api.post(
          "/admin/media",
          buildForm([{ name: "max.png", type: "image/png", content }]),
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.media_assets[0].size).toBe(DEFAULT_MAX_FILE_SIZE)
      })

      it("accepts exactly the maximum number of files", async () => {
        const form = buildForm(
          Array.from({ length: DEFAULT_MAX_FILES }, (_, index) => ({
            name: `photo-${index}.png`,
            type: "image/png",
          }))
        )

        const res = await api.post("/admin/media", form, adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data.media_assets).toHaveLength(DEFAULT_MAX_FILES)
      })

      it("matches alt values to files by index", async () => {
        const form = buildForm(
          [
            { name: "a.png", type: "image/png" },
            { name: "b.png", type: "image/png" },
            { name: "c.png", type: "image/png" },
            { name: "d.png", type: "image/png" },
          ],
          ["  Front view  ", "", "   "]
        )

        const res = await api.post("/admin/media", form, adminHeaders)

        expect(res.status).toBe(200)
        expect(
          res.data.media_assets.map(
            (asset: { filename: string; alt: string | null }) => [
              asset.filename,
              asset.alt,
            ]
          )
        ).toEqual([
          ["a.png", "Front view"],
          ["b.png", null],
          ["c.png", null],
          ["d.png", null],
        ])

        const mediaModuleService: MediaModuleService =
          getContainer().resolve(MEDIA_MODULE)
        const persisted = await mediaModuleService.listMediaAssets({
          id: res.data.media_assets.map((asset: { id: string }) => asset.id),
        })

        expect(
          Object.fromEntries(persisted.map((asset) => [asset.filename, asset.alt]))
        ).toEqual({
          "a.png": "Front view",
          "b.png": null,
          "c.png": null,
          "d.png": null,
        })
      })

      it("returns 400 when there are more alt values than files", async () => {
        const form = buildForm(
          [
            { name: "a.png", type: "image/png" },
            { name: "b.png", type: "image/png" },
          ],
          ["A", "B", "C"]
        )

        const res = await api
          .post("/admin/media", form, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("Received 3 alt values for 2 files")
        expect(await countMediaAssets()).toBe(0)
      })

      it("returns 401 without authentication", async () => {
        const res = await api
          .post(
            "/admin/media",
            buildForm([{ name: "front.png", type: "image/png" }])
          )
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })
  },
})
