import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { BRAND_MODULE } from "@dante0x95/medusa-plugin-brand/modules/brand"
import { createAdminUser } from "../helpers/admin-auth"
import { createPublishableKeyHeaders } from "../helpers/publishable-key"

jest.setTimeout(60 * 1000)

const PUBLIC_FIELDS = [
  "banner_url",
  "description",
  "handle",
  "id",
  "logo_url",
  "name",
]

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }
    let storeHeaders: { headers: Record<string, string> }
    let zara: { id: string }

    const createBrand = async (body: Record<string, unknown>) => {
      const res = await api.post("/admin/brands", body, adminHeaders)
      return res.data.brand
    }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
      storeHeaders = await createPublishableKeyHeaders(getContainer())

      zara = await createBrand({ name: "Zara", metadata: { internal: "secret" } })
      await createBrand({ name: "adidas" })
      await createBrand({ name: "Nike", description: "Just do it" })
      await createBrand({ name: "Hidden Label", is_active: false })
    })

    describe("GET /store/brands", () => {
      it("lists only active brands, sorted by name, with public fields only", async () => {
        const res = await api.get("/store/brands", storeHeaders)

        expect(res.status).toBe(200)
        expect(res.data).toEqual(
          expect.objectContaining({ count: 3, offset: 0, limit: 20 })
        )
        expect(res.data.brands.map((b) => b.name)).toEqual([
          "adidas",
          "Nike",
          "Zara",
        ])
        for (const brand of res.data.brands) {
          expect(Object.keys(brand).sort()).toEqual(PUBLIC_FIELDS)
        }
      })

      it("paginates", async () => {
        const res = await api.get("/store/brands?limit=2&offset=1", storeHeaders)

        expect(res.status).toBe(200)
        expect(res.data.count).toBe(3)
        expect(res.data.offset).toBe(1)
        expect(res.data.limit).toBe(2)
        expect(res.data.brands.map((b) => b.name)).toEqual(["Nike", "Zara"])
      })

      it("allows overriding the order", async () => {
        const res = await api.get("/store/brands?order=-name", storeHeaders)

        expect(res.status).toBe(200)
        expect(res.data.brands.map((b) => b.name)).toEqual([
          "Zara",
          "Nike",
          "adidas",
        ])
      })

      it("filters by handle", async () => {
        const res = await api.get("/store/brands?handle=nike", storeHeaders)

        expect(res.status).toBe(200)
        expect(res.data.count).toBe(1)
        expect(res.data.brands[0]).toEqual(
          expect.objectContaining({ name: "Nike", description: "Just do it" })
        )
      })

      it("does not return an inactive brand by handle", async () => {
        const res = await api.get(
          "/store/brands?handle=hidden-label",
          storeHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.count).toBe(0)
        expect(res.data.brands).toEqual([])
      })

      it("returns an empty list for an unknown handle", async () => {
        const res = await api.get(
          "/store/brands?handle=does-not-exist",
          storeHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.brands).toEqual([])
      })

      it("searches names case-insensitively with q", async () => {
        const res = await api.get("/store/brands?q=NI", storeHeaders)

        expect(res.status).toBe(200)
        expect(res.data.brands.map((b) => b.name)).toEqual(["Nike"])
      })

      it("treats LIKE wildcards in q literally", async () => {
        const percent = await api.get("/store/brands?q=%25", storeHeaders)
        const underscore = await api.get("/store/brands?q=_", storeHeaders)

        expect(percent.data.brands).toEqual([])
        expect(underscore.data.brands).toEqual([])
      })

      it("does not search inactive brands with q", async () => {
        const res = await api.get("/store/brands?q=hidden", storeHeaders)

        expect(res.status).toBe(200)
        expect(res.data.brands).toEqual([])
      })

      it.each(["metadata", "is_active", "*products", "products.id"])(
        "strips %s from fields",
        async (field) => {
          const container = getContainer()
          const {
            result: [product],
          } = await createProductsWorkflow(container).run({
            input: {
              products: [
                {
                  title: "Draft Shirt",
                  status: "draft",
                  options: [{ title: "Size", values: ["M"] }],
                  variants: [{ title: "M", options: { Size: "M" }, prices: [] }],
                },
              ],
            },
          })
          await container.resolve(ContainerRegistrationKeys.LINK).create({
            [Modules.PRODUCT]: { product_id: product.id },
            [BRAND_MODULE]: { brand_id: zara.id },
          })

          const res = await api.get(
            `/store/brands?fields=${field}`,
            storeHeaders
          )

          expect(res.status).toBe(200)
          expect(res.data.count).toBe(3)
          for (const brand of res.data.brands) {
            expect(brand).not.toHaveProperty("metadata")
            expect(brand).not.toHaveProperty("is_active")
            expect(brand).not.toHaveProperty("products")
          }
        }
      )

      it("never lists a deleted brand", async () => {
        await api.delete(`/admin/brands/${zara.id}`, adminHeaders)

        const res = await api.get("/store/brands?handle=zara", storeHeaders)

        expect(res.status).toBe(200)
        expect(res.data.count).toBe(0)
        expect(res.data.brands).toEqual([])
      })

      it("returns 400 for with_deleted", async () => {
        await api.delete(`/admin/brands/${zara.id}`, adminHeaders)

        const res = await api
          .get("/store/brands?with_deleted=true", storeHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 for an invalid limit", async () => {
        const res = await api
          .get("/store/brands?limit=abc", storeHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 for unknown query params", async () => {
        const res = await api
          .get("/store/brands?is_active=false", storeHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 without a publishable key", async () => {
        const res = await api.get("/store/brands").catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 with an invalid publishable key", async () => {
        const res = await api
          .get("/store/brands", {
            headers: { "x-publishable-api-key": "pk_does_not_exist" },
          })
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })
    })
  },
})
