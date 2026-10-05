import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { BRAND_MODULE } from "@dante0x95/medusa-plugin-brand/modules/brand"
import { createAdminUser } from "../helpers/admin-auth"
import { createPublishableKeyHeaders } from "../helpers/publishable-key"

jest.setTimeout(60 * 1000)

type ProductInput = {
  title: string
  status?: "draft" | "published"
  salesChannelId: string
  amount: number
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }
    let storeHeaders: { headers: Record<string, string> }
    let region: { id: string }
    let webChannel: { id: string }
    let otherChannel: { id: string }
    let nike: { id: string }
    let adidas: { id: string }

    const createBrand = async (body: Record<string, unknown>) => {
      const res = await api.post("/admin/brands", body, adminHeaders)
      return res.data.brand
    }

    const createProduct = async ({
      title,
      status = "published",
      salesChannelId,
      amount,
    }: ProductInput) => {
      const {
        result: [product],
      } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title,
              status,
              sales_channels: [{ id: salesChannelId }],
              options: [{ title: "Size", values: ["M"] }],
              variants: [
                {
                  title: "M",
                  options: { Size: "M" },
                  manage_inventory: false,
                  prices: [{ amount, currency_code: "eur" }],
                },
              ],
            },
          ],
        },
      })
      return product
    }

    const linkProduct = (productId: string, brandId: string) =>
      getContainer()
        .resolve(ContainerRegistrationKeys.LINK)
        .create({
          [Modules.PRODUCT]: { product_id: productId },
          [BRAND_MODULE]: { brand_id: brandId },
        })

    const createBrandProduct = async (brandId: string, input: ProductInput) => {
      const product = await createProduct(input)
      await linkProduct(product.id, brandId)
      return product
    }

    const getProducts = (path: string, headers = storeHeaders) =>
      api.get(path, headers).catch((e) => e.response)

    beforeEach(async () => {
      const container = getContainer()
      adminHeaders = await createAdminUser(api, container)

      const { result: channels } = await createSalesChannelsWorkflow(
        container
      ).run({
        input: {
          salesChannelsData: [{ name: "Web" }, { name: "Wholesale" }],
        },
      })
      ;[webChannel, otherChannel] = channels

      const { result: regions } = await createRegionsWorkflow(container).run({
        input: { regions: [{ name: "Europe", currency_code: "eur" }] },
      })
      region = regions[0]

      storeHeaders = await createPublishableKeyHeaders(container, [
        webChannel.id,
      ])

      nike = await createBrand({ name: "Nike" })
      adidas = await createBrand({ name: "Adidas" })
    })

    describe("GET /store/brands/:id/products", () => {
      it("lists the brand's published products in the key's sales channel with calculated prices", async () => {
        const shirt = await createBrandProduct(nike.id, {
          title: "Nike Shirt",
          salesChannelId: webChannel.id,
          amount: 30,
        })
        const shoes = await createBrandProduct(nike.id, {
          title: "Nike Shoes",
          salesChannelId: webChannel.id,
          amount: 120.5,
        })
        await createBrandProduct(nike.id, {
          title: "Nike Draft",
          status: "draft",
          salesChannelId: webChannel.id,
          amount: 10,
        })
        await createBrandProduct(nike.id, {
          title: "Nike Wholesale",
          salesChannelId: otherChannel.id,
          amount: 10,
        })
        await createBrandProduct(adidas.id, {
          title: "Adidas Shirt",
          salesChannelId: webChannel.id,
          amount: 25,
        })
        await createProduct({
          title: "Unbranded",
          salesChannelId: webChannel.id,
          amount: 5,
        })

        const res = await getProducts(
          `/store/brands/${nike.id}/products?region_id=${region.id}`
        )

        expect(res.status).toBe(200)
        expect(res.data).toEqual(
          expect.objectContaining({ count: 2, offset: 0, limit: 20 })
        )
        expect(res.data.products.map((p) => p.id).sort()).toEqual(
          [shirt.id, shoes.id].sort()
        )

        const byId = Object.fromEntries(
          res.data.products.map((p) => [p.id, p])
        )
        expect(byId[shirt.id].variants[0].calculated_price).toEqual(
          expect.objectContaining({
            calculated_amount: 30,
            currency_code: "eur",
          })
        )
        expect(byId[shoes.id].variants[0].calculated_price).toEqual(
          expect.objectContaining({
            calculated_amount: 120.5,
            currency_code: "eur",
          })
        )
      })

      it("paginates", async () => {
        for (const title of ["A", "B", "C"]) {
          await createBrandProduct(nike.id, {
            title,
            salesChannelId: webChannel.id,
            amount: 10,
          })
        }

        const base = `/store/brands/${nike.id}/products?region_id=${region.id}&limit=2`
        const first = await getProducts(`${base}&offset=0`)
        const second = await getProducts(`${base}&offset=2`)

        expect(first.status).toBe(200)
        expect(first.data).toEqual(
          expect.objectContaining({ count: 3, offset: 0, limit: 2 })
        )
        expect(first.data.products).toHaveLength(2)
        expect(second.data).toEqual(
          expect.objectContaining({ count: 3, offset: 2, limit: 2 })
        )
        expect(second.data.products).toHaveLength(1)

        const ids = [...first.data.products, ...second.data.products].map(
          (p) => p.id
        )
        expect(new Set(ids).size).toBe(3)
      })

      it("returns an empty list for a brand without visible products", async () => {
        await createBrandProduct(nike.id, {
          title: "Nike Wholesale",
          salesChannelId: otherChannel.id,
          amount: 10,
        })

        const res = await getProducts(
          `/store/brands/${nike.id}/products?region_id=${region.id}`
        )

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          products: [],
          count: 0,
          offset: 0,
          limit: 20,
        })
      })

      it("does not expose the brand link through fields", async () => {
        await createBrandProduct(nike.id, {
          title: "Nike Shirt",
          salesChannelId: webChannel.id,
          amount: 30,
        })

        const res = await getProducts(
          `/store/brands/${nike.id}/products?region_id=${region.id}&fields=*brand`
        )

        expect(res.status).toBe(200)
        expect(res.data.products[0]).not.toHaveProperty("brand")
      })

      it("returns 404 for an unknown brand", async () => {
        const res = await getProducts(
          `/store/brands/brand_does_not_exist/products?region_id=${region.id}`
        )

        expect(res.status).toBe(404)
      })

      it("returns 404 for an inactive brand", async () => {
        const hidden = await createBrand({ name: "Hidden", is_active: false })
        await createBrandProduct(hidden.id, {
          title: "Hidden Shirt",
          salesChannelId: webChannel.id,
          amount: 30,
        })

        const res = await getProducts(
          `/store/brands/${hidden.id}/products?region_id=${region.id}`
        )

        expect(res.status).toBe(404)
      })

      it("returns 404 for a deleted brand", async () => {
        await api.delete(`/admin/brands/${nike.id}`, adminHeaders)

        const res = await getProducts(
          `/store/brands/${nike.id}/products?region_id=${region.id}`
        )

        expect(res.status).toBe(404)
      })

      it("returns 400 without region_id", async () => {
        const res = await getProducts(`/store/brands/${nike.id}/products`)

        expect(res.status).toBe(400)
      })

      it("returns 400 for an unknown region_id", async () => {
        const res = await getProducts(
          `/store/brands/${nike.id}/products?region_id=reg_does_not_exist`
        )

        expect(res.status).toBe(400)
      })

      it.each([
        ["an invalid limit", "limit=abc"],
        ["with_deleted", "with_deleted=true"],
        ["unknown query params", "status=draft"],
      ])("returns 400 for %s", async (_, params) => {
        const res = await getProducts(
          `/store/brands/${nike.id}/products?region_id=${region.id}&${params}`
        )

        expect(res.status).toBe(400)
      })

      it("returns 400 without a publishable key", async () => {
        const res = await getProducts(
          `/store/brands/${nike.id}/products?region_id=${region.id}`,
          { headers: {} }
        )

        expect(res.status).toBe(400)
      })

      it("returns 400 for a publishable key without a sales channel", async () => {
        const headers = await createPublishableKeyHeaders(getContainer())

        const res = await getProducts(
          `/store/brands/${nike.id}/products?region_id=${region.id}`,
          headers
        )

        expect(res.status).toBe(400)
      })
    })
  },
})
