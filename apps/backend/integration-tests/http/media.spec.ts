import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { MEDIA_MODULE } from "../../src/modules/media"
import MediaModuleService, {
  DEFAULT_MAX_FILE_SIZE,
} from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin-auth"

jest.setTimeout(60 * 1000)

type UploadFile = {
  name: string
  type: string
  content?: Buffer
}

const buildForm = (files: UploadFile[], alts: string[] = []) => {
  const form = new FormData()

  for (const file of files) {
    form.append(
      "files",
      new Blob([new Uint8Array(file.content ?? Buffer.from(`content of ${file.name}`))], {
        type: file.type,
      }),
      file.name
    )
  }

  for (const alt of alts) {
    form.append("alt", alt)
  }

  return form
}

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
            size: Buffer.byteLength("content of front.png"),
            alt: "Front view",
          }),
          expect.objectContaining({
            id: expect.stringMatching(/^media_/),
            url: expect.any(String),
            file_id: expect.any(String),
            filename: "back.jpg",
            mime_type: "image/jpeg",
            size: Buffer.byteLength("content of back.jpg"),
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

        const [createdFiles] = await createFilesSpy.mock.results[0].value
        expect(deleteFilesSpy).toHaveBeenCalledWith([createdFiles.id])
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
