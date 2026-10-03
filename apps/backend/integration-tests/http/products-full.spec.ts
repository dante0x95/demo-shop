import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStockLocationsWorkflow } from "@medusajs/medusa/core-flows"
import ProductBrandLink from "../../src/links/product-brand"
import { createAdminUser } from "../helpers/admin-auth"
import { buildMediaForm } from "../helpers/media-form"

jest.setTimeout(60 * 1000)

const UNKNOWN_BRAND_ID = "brand_01UNKNOWN000000000000000000"
const UNKNOWN_LOCATION_ID = "sloc_01UNKNOWN000000000000000000"
const UNKNOWN_MEDIA_ID = "media_01UNKNOWN000000000000000000"

type MediaAsset = { id: string; url: string }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }
    let brand: { id: string; name: string; handle: string }
    let front: MediaAsset
    let back: MediaAsset
    let warehouseId: string
    let storeId: string

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())

      const brandRes = await api.post(
        "/admin/brands",
        { name: "Nike" },
        adminHeaders
      )
      brand = brandRes.data.brand

      const mediaRes = await api.post(
        "/admin/media",
        buildMediaForm([
          { name: "front.png", type: "image/png" },
          { name: "back.png", type: "image/png" },
        ]),
        adminHeaders
      )
      ;[front, back] = mediaRes.data.media_assets

      const { result: locations } = await createStockLocationsWorkflow(
        getContainer()
      ).run({
        input: { locations: [{ name: "Warehouse" }, { name: "Store" }] },
      })
      ;[warehouseId, storeId] = locations.map((location) => location.id)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    // A t-shirt in two sizes with prices, stock in both locations, the brand
    // and both images.
    const fullBody = (
      overrides: Record<string, unknown> = {}
    ): Record<string, any> => ({
      title: "Basic Tee",
      options: [{ title: "Size", values: ["S", "M"] }],
      variants: [
        {
          title: "S",
          sku: "TEE-S",
          options: { Size: "S" },
          prices: [{ currency_code: "usd", amount: 19.99 }],
          stock: [
            { location_id: warehouseId, quantity: 10 },
            { location_id: storeId, quantity: 2 },
          ],
        },
        {
          title: "M",
          sku: "TEE-M",
          options: { Size: "M" },
          prices: [{ currency_code: "usd", amount: 21.5 }],
          stock: [{ location_id: warehouseId, quantity: 5 }],
        },
      ],
      images: [front.id, back.id],
      additional_data: { brand_id: brand.id },
      ...overrides,
    })

    const postFull = (body: Record<string, unknown>) =>
      api
        .post("/admin/products/full", body, adminHeaders)
        .catch((e: any) => e.response)

    const brandLinks = async (productId: string) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: ProductBrandLink.entryPoint,
        fields: ["product_id", "brand_id"],
        filters: { product_id: productId },
      })
      return data
    }

    // What a failed request must not leave behind.
    const leftovers = async () => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const [
        { data: products },
        { data: inventoryItems },
        { data: levels },
        { data: links },
      ] = await Promise.all([
        query.graph({ entity: "product", fields: ["id"] }),
        query.graph({ entity: "inventory_item", fields: ["id"] }),
        query.graph({ entity: "inventory_level", fields: ["id"] }),
        query.graph({
          entity: ProductBrandLink.entryPoint,
          fields: ["product_id"],
        }),
      ])
      return {
        products: products.length,
        inventory_items: inventoryItems.length,
        inventory_levels: levels.length,
        brand_links: links.length,
      }
    }

    const stockOf = (variant: any) =>
      Object.fromEntries(
        variant.inventory_items[0].inventory.location_levels.map(
          (level: any) => [level.location_id, level.stocked_quantity]
        )
      )

    describe("POST /admin/products/full", () => {
      it("creates the product with variants, prices, stock, brand and images", async () => {
        const res = await postFull(fullBody())

        expect(res.status).toBe(200)

        const { product } = res.data
        expect(product).toEqual(
          expect.objectContaining({
            title: "Basic Tee",
            status: "draft",
            thumbnail: front.url,
            brand: { id: brand.id, name: "Nike", handle: brand.handle },
          })
        )
        expect(
          [...product.images]
            .sort((a: any, b: any) => a.rank - b.rank)
            .map((image: any) => image.url)
        ).toEqual([front.url, back.url])
        expect(product.options).toEqual([
          expect.objectContaining({
            title: "Size",
            values: expect.arrayContaining([
              expect.objectContaining({ value: "S" }),
              expect.objectContaining({ value: "M" }),
            ]),
          }),
        ])

        const bySku = Object.fromEntries(
          product.variants.map((variant: any) => [variant.sku, variant])
        )
        expect(bySku["TEE-S"].prices).toEqual([
          expect.objectContaining({ currency_code: "usd", amount: 19.99 }),
        ])
        expect(bySku["TEE-M"].prices).toEqual([
          expect.objectContaining({ currency_code: "usd", amount: 21.5 }),
        ])
        expect(stockOf(bySku["TEE-S"])).toEqual({
          [warehouseId]: 10,
          [storeId]: 2,
        })
        expect(stockOf(bySku["TEE-M"])).toEqual({ [warehouseId]: 5 })

        expect(await brandLinks(product.id)).toHaveLength(1)
      })

      it("uses thumbnail_id as the thumbnail", async () => {
        const res = await postFull(fullBody({ thumbnail_id: back.id }))

        expect(res.status).toBe(200)
        expect(res.data.product.thumbnail).toBe(back.url)
      })

      it("keeps T07's in-use check: a used image can't be deleted", async () => {
        await postFull(fullBody())

        const res = await api
          .delete(`/admin/media/${back.id}`, adminHeaders)
          .catch((e: any) => e.response)

        expect(res.status).toBe(409)
      })

      it("creates the product without a brand, images or stock", async () => {
        const res = await postFull({
          title: "Plain Tee",
          options: [{ title: "Size", values: ["S"] }],
          variants: [
            {
              title: "S",
              options: { Size: "S" },
              prices: [{ currency_code: "usd", amount: 10 }],
            },
          ],
        })

        expect(res.status).toBe(200)
        expect(res.data.product.thumbnail).toBeNull()
        expect(res.data.product.images).toEqual([])
        expect(
          res.data.product.variants[0].inventory_items[0].inventory
            .location_levels
        ).toEqual([])
        expect(await brandLinks(res.data.product.id)).toEqual([])
      })

      it("accepts an inactive brand", async () => {
        await api.post(
          `/admin/brands/${brand.id}`,
          { is_active: false },
          adminHeaders
        )

        const res = await postFull(fullBody())

        expect(res.status).toBe(200)
        expect(res.data.product.brand.id).toBe(brand.id)
      })

      // Overrides are built lazily: the media assets exist only after beforeEach.
      it.each([
        ["title is missing", () => ({ title: undefined })],
        ["an unknown field is sent", () => ({ thumbnail: "https://x.test/a.png" })],
        ["thumbnail_id is not one of images", () => ({ thumbnail_id: UNKNOWN_MEDIA_ID })],
        ["an image repeats", () => ({ images: [front.id, front.id] })],
      ])("returns 400 when %s", async (_, overrides) => {
        const before = await leftovers()

        const res = await postFull(fullBody(overrides()))

        expect(res.status).toBe(400)
        expect(await leftovers()).toEqual(before)
      })

      it("returns 400 for stock on a variant that doesn't manage inventory", async () => {
        const body = fullBody()
        body.variants[0] = { ...body.variants[0], manage_inventory: false }

        const res = await postFull(body)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain(
          "stock requires manage_inventory to be true"
        )
      })

      it("returns 400 for a location repeated in a variant's stock", async () => {
        const body = fullBody()
        body.variants[1].stock = [
          { location_id: warehouseId, quantity: 1 },
          { location_id: warehouseId, quantity: 2 },
        ]

        const res = await postFull(body)

        expect(res.status).toBe(400)
        expect(res.data.message).toContain(
          "Each location can appear only once in stock"
        )
      })

      it("returns 400 for an unknown brand and leaves nothing behind", async () => {
        const before = await leftovers()

        const res = await postFull(
          fullBody({ additional_data: { brand_id: UNKNOWN_BRAND_ID } })
        )

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          `Brand with id: ${UNKNOWN_BRAND_ID} was not found`
        )
        expect(await leftovers()).toEqual(before)
      })

      it("returns 400 for an unknown location and leaves nothing behind", async () => {
        const before = await leftovers()
        const body = fullBody()
        body.variants[1].stock = [
          { location_id: UNKNOWN_LOCATION_ID, quantity: 1 },
        ]

        const res = await postFull(body)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          `Stock locations with ids: ${UNKNOWN_LOCATION_ID} were not found`
        )
        expect(await leftovers()).toEqual(before)
      })

      it("returns 400 for an unknown media asset and leaves nothing behind", async () => {
        const before = await leftovers()

        const res = await postFull(
          fullBody({ images: [front.id, UNKNOWN_MEDIA_ID] })
        )

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          `Media assets with ids: ${UNKNOWN_MEDIA_ID} were not found`
        )
        expect(await leftovers()).toEqual(before)
      })

      it("rolls everything back when the stock can't be saved", async () => {
        const before = await leftovers()
        jest
          .spyOn(
            getContainer().resolve(Modules.INVENTORY),
            "createInventoryLevels"
          )
          .mockRejectedValueOnce(new Error("inventory down"))

        const res = await postFull(fullBody())

        expect(res.status).toBe(500)
        expect(await leftovers()).toEqual(before)
      })

      it("returns 400 for a deleted media asset", async () => {
        await api.delete(`/admin/media/${back.id}`, adminHeaders)

        const res = await postFull(fullBody())

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          `Media assets with ids: ${back.id} were not found`
        )
      })

      it("returns 401 without auth", async () => {
        const res = await api
          .post("/admin/products/full", fullBody())
          .catch((e: any) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("POST /admin/products with additional_data.brand_id", () => {
      const coreBody = (brandId: string) => ({
        title: "Core Tee",
        options: [{ title: "Size", values: ["S"] }],
        variants: [
          {
            title: "S",
            options: { Size: "S" },
            prices: [{ currency_code: "usd", amount: 10 }],
          },
        ],
        additional_data: { brand_id: brandId },
      })

      it("links the brand once", async () => {
        const res = await api.post(
          "/admin/products",
          coreBody(brand.id),
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(await brandLinks(res.data.product.id)).toEqual([
          expect.objectContaining({ brand_id: brand.id }),
        ])
      })

      it("returns 400 for an unknown brand and leaves nothing behind", async () => {
        const before = await leftovers()

        const res = await api
          .post("/admin/products", coreBody(UNKNOWN_BRAND_ID), adminHeaders)
          .catch((e: any) => e.response)

        expect(res.status).toBe(400)
        expect(await leftovers()).toEqual(before)
      })

      it("returns 400 for a brand_id that isn't a string", async () => {
        const res = await api
          .post(
            "/admin/products",
            { ...coreBody(brand.id), additional_data: { brand_id: 1 } },
            adminHeaders
          )
          .catch((e: any) => e.response)

        expect(res.status).toBe(400)
      })
    })
  },
})
