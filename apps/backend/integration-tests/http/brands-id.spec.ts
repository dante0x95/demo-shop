import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import ProductBrandLink from "../../src/links/product-brand"
import { BRAND_MODULE } from "../../src/modules/brand"
import { createAdminUser } from "../helpers/admin-auth"

jest.setTimeout(60 * 1000)

const UNKNOWN_ID = "brand_does_not_exist"

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    const createBrand = async (body: Record<string, unknown>) => {
      const res = await api.post("/admin/brands", body, adminHeaders)
      return res.data.brand
    }

    const createProductForBrand = async (brandId: string) => {
      const container = getContainer()

      const {
        result: [product],
      } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Linked Shirt",
              status: "published",
              options: [{ title: "Size", values: ["M"] }],
              variants: [{ title: "M", options: { Size: "M" }, prices: [] }],
            },
          ],
        },
      })

      const link = container.resolve(ContainerRegistrationKeys.LINK)
      await link.create({
        [Modules.PRODUCT]: { product_id: product.id },
        [BRAND_MODULE]: { brand_id: brandId },
      })

      return product
    }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("GET /admin/brands/:id", () => {
      it("returns the brand with an empty products list", async () => {
        const brand = await createBrand({ name: "Nike" })

        const res = await api.get(`/admin/brands/${brand.id}`, adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data.brand).toEqual(
          expect.objectContaining({
            id: brand.id,
            name: "Nike",
            handle: "nike",
            is_active: true,
            products: [],
          })
        )
      })

      it("returns linked products", async () => {
        const brand = await createBrand({ name: "Nike" })
        const product = await createProductForBrand(brand.id)

        const res = await api.get(`/admin/brands/${brand.id}`, adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data.brand.products).toEqual([
          {
            id: product.id,
            title: "Linked Shirt",
            handle: product.handle,
            status: "published",
            thumbnail: null,
          },
        ])
      })

      it("returns 404 for an unknown id", async () => {
        const res = await api
          .get(`/admin/brands/${UNKNOWN_ID}`, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const brand = await createBrand({ name: "Nike" })

        const res = await api
          .get(`/admin/brands/${brand.id}`)
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("POST /admin/brands/:id", () => {
      it("updates only the fields sent", async () => {
        const brand = await createBrand({
          name: "Nike",
          logo_url: "https://cdn.example.com/nike.png",
        })

        const res = await api.post(
          `/admin/brands/${brand.id}`,
          { description: "Just do it" },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.brand).toEqual(
          expect.objectContaining({
            id: brand.id,
            name: "Nike",
            handle: "nike",
            description: "Just do it",
            logo_url: "https://cdn.example.com/nike.png",
            is_active: true,
            products: [],
          })
        )
      })

      it("keeps the handle when the name changes", async () => {
        const brand = await createBrand({ name: "Nike" })

        const res = await api.post(
          `/admin/brands/${brand.id}`,
          { name: "  Nike Sportswear  " },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.brand.name).toBe("Nike Sportswear")
        expect(res.data.brand.handle).toBe("nike")
      })

      it("normalizes an explicit handle", async () => {
        const brand = await createBrand({ name: "Nike" })

        const res = await api.post(
          `/admin/brands/${brand.id}`,
          { handle: "Nike Sportswear", is_active: false },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.brand.handle).toBe("nike-sportswear")
        expect(res.data.brand.is_active).toBe(false)
      })

      it("allows changing the case of the brand's own name", async () => {
        const brand = await createBrand({ name: "nike" })

        const res = await api.post(
          `/admin/brands/${brand.id}`,
          { name: "NIKE", handle: "nike" },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.brand.name).toBe("NIKE")
      })

      it("returns 400 when another brand has the name, regardless of case", async () => {
        await createBrand({ name: "Nike" })
        const brand = await createBrand({ name: "Adidas" })

        const res = await api
          .post(`/admin/brands/${brand.id}`, { name: "NIKE" }, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("A brand with this name already exists")
      })

      it("returns 400 when another brand has the handle", async () => {
        await createBrand({ name: "Nike" })
        const brand = await createBrand({ name: "Adidas" })

        const res = await api
          .post(`/admin/brands/${brand.id}`, { handle: "nike" }, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("A brand with this handle already exists")

        const unchanged = await api.get(
          `/admin/brands/${brand.id}`,
          adminHeaders
        )
        expect(unchanged.data.brand.handle).toBe("adidas")
      })

      it("returns 400 when the handle has no letter or digit", async () => {
        const brand = await createBrand({ name: "Nike" })

        const res = await api
          .post(`/admin/brands/${brand.id}`, { handle: "!!!" }, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it.each([
        ["an empty name", { name: "  " }],
        ["a null name", { name: null }],
        ["an invalid logo_url", { logo_url: "not-a-url" }],
        ["an unknown field", { color: "red" }],
      ])("returns 400 for %s", async (_, body) => {
        const brand = await createBrand({ name: "Nike" })

        const res = await api
          .post(`/admin/brands/${brand.id}`, body, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 404 for an unknown id", async () => {
        const res = await api
          .post(`/admin/brands/${UNKNOWN_ID}`, { name: "Ghost" }, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const brand = await createBrand({ name: "Nike" })

        const res = await api
          .post(`/admin/brands/${brand.id}`, { name: "Hacked" })
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("DELETE /admin/brands/:id", () => {
      it("deletes the brand", async () => {
        const brand = await createBrand({ name: "Nike" })

        const res = await api.delete(`/admin/brands/${brand.id}`, adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          id: brand.id,
          object: "brand",
          deleted: true,
        })

        const after = await api
          .get(`/admin/brands/${brand.id}`, adminHeaders)
          .catch((e) => e.response)
        expect(after.status).toBe(404)
      })

      it("unlinks products without deleting them", async () => {
        const brand = await createBrand({ name: "Nike" })
        const product = await createProductForBrand(brand.id)

        await api.delete(`/admin/brands/${brand.id}`, adminHeaders)

        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const {
          data: [found],
        } = await query.graph({
          entity: "product",
          fields: ["id", "brand.id"],
          filters: { id: product.id },
        })

        expect(found.id).toBe(product.id)
        expect(found.brand).toBeFalsy()

        // The soft-deleted brand alone would hide product.brand; check the link row too.
        const { data: links } = await query.graph({
          entity: ProductBrandLink.entryPoint,
          fields: ["product_id", "brand_id"],
          filters: { product_id: product.id },
        })
        expect(links).toEqual([])
      })

      it("frees the name and handle for a new brand", async () => {
        const brand = await createBrand({ name: "Nike" })
        await api.delete(`/admin/brands/${brand.id}`, adminHeaders)

        const res = await api.post(
          "/admin/brands",
          { name: "Nike" },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.brand.handle).toBe("nike")
      })

      it("returns 404 for an already deleted brand", async () => {
        const brand = await createBrand({ name: "Nike" })
        await api.delete(`/admin/brands/${brand.id}`, adminHeaders)

        const res = await api
          .delete(`/admin/brands/${brand.id}`, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("returns 404 for an unknown id", async () => {
        const res = await api
          .delete(`/admin/brands/${UNKNOWN_ID}`, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const brand = await createBrand({ name: "Nike" })

        const res = await api
          .delete(`/admin/brands/${brand.id}`)
          .catch((e) => e.response)

        expect(res.status).toBe(401)

        const still = await api.get(`/admin/brands/${brand.id}`, adminHeaders)
        expect(still.status).toBe(200)
      })
    })
  },
})
