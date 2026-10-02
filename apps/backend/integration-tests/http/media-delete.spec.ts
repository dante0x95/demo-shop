import { existsSync } from "fs"
import path from "path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  deleteProductsWorkflow,
  updateProductVariantsWorkflow,
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

    // A product that shows `url` in each of the given places.
    const createProductUsing = async (
      url: string,
      usages: ("image" | "thumbnail" | "variant_thumbnail")[]
    ) => {
      const {
        result: [product],
      } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: "Shirt",
              options: [{ title: "Size", values: ["M"] }],
              images: usages.includes("image") ? [{ url }] : [],
              thumbnail: usages.includes("thumbnail") ? url : null,
              variants: [{ title: "M", options: { Size: "M" } }],
            },
          ],
        },
      })

      // Variant thumbnails can only be set on update, as in the admin API.
      if (usages.includes("variant_thumbnail")) {
        await updateProductVariantsWorkflow(getContainer()).run({
          input: {
            selector: { product_id: product.id },
            update: { thumbnail: url },
          },
        })
      }

      return product
    }

    const conflictMessage = (id: string) =>
      `Media asset with id: ${id} is used by 1 product(s). Remove it from their images and thumbnails before deleting it`

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

      it.each([
        ["an image", ["image"]],
        ["the product thumbnail", ["thumbnail"]],
        ["a variant thumbnail", ["variant_thumbnail"]],
      ] as const)(
        "returns 409 and keeps the asset when a product uses it as %s",
        async (_, usages) => {
          const asset = await uploadAsset()
          await createProductUsing(asset.url, [...usages])

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
            message: conflictMessage(asset.id),
          })
          expect(await listedIds()).toContain(asset.id)
          expect(deleteFilesSpy).not.toHaveBeenCalled()
          expect(storedFileExists(asset.file_id)).toBe(true)
        }
      )

      it("counts a product that uses the asset in several places once", async () => {
        const asset = await uploadAsset()
        await createProductUsing(asset.url, [
          "image",
          "thumbnail",
          "variant_thumbnail",
        ])

        const err = await api
          .delete(`/admin/media/${asset.id}`, adminHeaders)
          .catch((e: any) => e)

        expect(err.response.status).toBe(409)
        expect(err.response.data.message).toBe(conflictMessage(asset.id))
      })

      it("deletes the asset once no product uses it anymore", async () => {
        const asset = await uploadAsset()
        const product = await createProductUsing(asset.url, [
          "image",
          "thumbnail",
          "variant_thumbnail",
        ])

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
