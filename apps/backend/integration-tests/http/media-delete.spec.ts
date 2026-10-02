import { existsSync } from "fs"
import path from "path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { createAdminUser } from "../helpers/admin-auth"
import { buildMediaForm } from "../helpers/media-form"

jest.setTimeout(60 * 1000)

const UNKNOWN_ID = "media_01UNKNOWN000000000000000000"

type MediaAsset = { id: string; url: string; file_id: string }

// The local file provider stores uploads under `static/<file_id>`.
const storedFileExists = (fileId: string) =>
  existsSync(path.join(process.cwd(), "static", fileId))

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

    const uploadAsset = async (name = "photo.png"): Promise<MediaAsset> => {
      const res = await api.post(
        "/admin/media",
        buildMediaForm([{ name, type: "image/png" }]),
        adminHeaders
      )

      return res.data.media_assets[0]
    }

    const listedIds = async () => {
      const res = await api.get("/admin/media", adminHeaders)

      return res.data.media_assets.map((asset: { id: string }) => asset.id)
    }

    const createProductWithImage = async (url: string) => {
      const {
        result: [product],
      } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: "Shirt",
              options: [{ title: "Size", values: ["M"] }],
              images: [{ url }],
            },
          ],
        },
      })

      return product
    }

    describe("DELETE /admin/media/:id", () => {
      it("deletes the asset and its stored file", async () => {
        const asset = await uploadAsset()
        expect(storedFileExists(asset.file_id)).toBe(true)

        const deleteFilesSpy = jest.spyOn(
          getContainer().resolve(Modules.FILE),
          "deleteFiles"
        )

        const res = await api.delete(`/admin/media/${asset.id}`, adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          id: asset.id,
          object: "media_asset",
          deleted: true,
        })
        expect(await listedIds()).not.toContain(asset.id)
        expect(deleteFilesSpy).toHaveBeenCalledWith([asset.file_id])
        expect(storedFileExists(asset.file_id)).toBe(false)
      })

      it("keeps the other assets", async () => {
        const asset = await uploadAsset("a.png")
        const other = await uploadAsset("b.png")

        await api.delete(`/admin/media/${asset.id}`, adminHeaders)

        expect(await listedIds()).toEqual([other.id])
        expect(storedFileExists(other.file_id)).toBe(true)
      })

      it("returns 409 and keeps the asset when a product uses it", async () => {
        const asset = await uploadAsset()
        await createProductWithImage(asset.url)

        const deleteFilesSpy = jest.spyOn(
          getContainer().resolve(Modules.FILE),
          "deleteFiles"
        )

        const err = await api
          .delete(`/admin/media/${asset.id}`, adminHeaders)
          .catch((e: any) => e)

        expect(err.response.status).toBe(409)
        expect(err.response.data).toEqual({
          type: "conflict",
          message: `Media asset with id: ${asset.id} is used by 1 product(s). Remove it from their images before deleting it`,
        })
        expect(await listedIds()).toContain(asset.id)
        expect(deleteFilesSpy).not.toHaveBeenCalled()
        expect(storedFileExists(asset.file_id)).toBe(true)
      })

      it("deletes the asset once no product uses it anymore", async () => {
        const asset = await uploadAsset()
        const product = await createProductWithImage(asset.url)

        await deleteProductsWorkflow(getContainer()).run({
          input: { ids: [product.id] },
        })

        const res = await api.delete(`/admin/media/${asset.id}`, adminHeaders)

        expect(res.status).toBe(200)
        expect(await listedIds()).not.toContain(asset.id)
      })

      it("restores the asset when the file can't be deleted", async () => {
        const asset = await uploadAsset()

        jest
          .spyOn(getContainer().resolve(Modules.FILE), "deleteFiles")
          .mockRejectedValueOnce(new Error("Storage unavailable"))

        const err = await api
          .delete(`/admin/media/${asset.id}`, adminHeaders)
          .catch((e: any) => e)

        expect(err.response.status).toBe(500)
        expect(await listedIds()).toContain(asset.id)
        expect(storedFileExists(asset.file_id)).toBe(true)
      })

      it("returns 404 for an already deleted asset", async () => {
        const asset = await uploadAsset()
        await api.delete(`/admin/media/${asset.id}`, adminHeaders)

        const err = await api
          .delete(`/admin/media/${asset.id}`, adminHeaders)
          .catch((e: any) => e)

        expect(err.response.status).toBe(404)
      })

      it("returns 404 for an unknown id", async () => {
        const err = await api
          .delete(`/admin/media/${UNKNOWN_ID}`, adminHeaders)
          .catch((e: any) => e)

        expect(err.response.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const asset = await uploadAsset()

        const err = await api
          .delete(`/admin/media/${asset.id}`)
          .catch((e: any) => e)

        expect(err.response.status).toBe(401)
        expect(await listedIds()).toContain(asset.id)
      })
    })
  },
})
