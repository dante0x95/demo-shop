import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  createStep,
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { BRAND_MODULE } from "@dante0x95/medusa-plugin-brand/modules/brand"
import { VARIANT_PRICING_MODULE } from "../../src/modules/variant-pricing"
import VariantPricingModuleService from "../../src/modules/variant-pricing/service"
import {
  upsertVariantPriceDetailsStep,
  UpsertVariantPriceDetailsStepInput,
} from "../../src/workflows/variant-pricing/steps/upsert-variant-price-details"
import { createAdminUser } from "../helpers/admin-auth"
import { createPublishableKeyHeaders } from "../helpers/publishable-key"

jest.setTimeout(60 * 1000)

// Runs the upsert step and then fails, so its compensation runs.
const failStep = createStep("test-fail-after-variant-pricing", async () => {
  throw new Error("Later step failed")
})

const upsertThenFailWorkflow = createWorkflow(
  "test-upsert-variant-price-details-then-fail",
  function (input: UpsertVariantPriceDetailsStepInput) {
    upsertVariantPriceDetailsStep(input)
    failStep()

    return new WorkflowResponse(input)
  }
)

type Variant = { id: string; title: string }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }
    let storeHeaders: { headers: Record<string, string> }
    let region: { id: string }
    let webChannel: { id: string }

    // A product with variants "S" (10 EUR) and "M" (20 EUR), unless other
    // prices are given. The store's default currency is EUR.
    const createProduct = async (
      title = "Shirt",
      prices: Record<string, { amount: number; currency_code: string }[]> = {
        S: [{ amount: 10, currency_code: "eur" }],
        M: [{ amount: 20, currency_code: "eur" }],
      }
    ) => {
      const sizes = Object.keys(prices)
      const {
        result: [product],
      } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title,
              status: "published",
              sales_channels: [{ id: webChannel.id }],
              options: [{ title: "Size", values: sizes }],
              variants: sizes.map((size) => ({
                title: size,
                sku: `${title}-${size}`,
                options: { Size: size },
                manage_inventory: false,
                prices: prices[size],
              })),
            },
          ],
        },
      })

      const variants = Object.fromEntries(
        (product.variants as Variant[]).map((variant) => [
          variant.title,
          variant,
        ])
      )

      return { product, variants }
    }

    const pricingPath = (productId: string) =>
      `/admin/products/${productId}/variant-pricing`

    const getPricing = (productId: string, headers: unknown = adminHeaders) =>
      api.get(pricingPath(productId), headers).catch((e) => e.response)

    const postPricing = (
      productId: string,
      body: unknown,
      headers: unknown = adminHeaders
    ) =>
      api.post(pricingPath(productId), body, headers).catch((e) => e.response)

    const getStore = (path: string, headers: unknown = storeHeaders) =>
      api.get(path, headers).catch((e) => e.response)

    const listRows = (variantIds: string[]) =>
      getContainer()
        .resolve<VariantPricingModuleService>(VARIANT_PRICING_MODULE)
        .listVariantPriceDetails({ variant_id: variantIds })

    // Response variants by id (admin: variant_id, store: id).
    const byVariantId = (items: any[]): Record<string, any> =>
      Object.fromEntries(
        items.map((item) => [item.variant_id ?? item.id, item])
      )

    beforeEach(async () => {
      const container = getContainer()
      adminHeaders = await createAdminUser(api, container)

      const { result: channels } = await createSalesChannelsWorkflow(
        container
      ).run({ input: { salesChannelsData: [{ name: "Web" }] } })
      webChannel = channels[0]

      const { result: regions } = await createRegionsWorkflow(container).run({
        input: { regions: [{ name: "Europe", currency_code: "eur" }] },
      })
      region = regions[0]

      storeHeaders = await createPublishableKeyHeaders(container, [
        webChannel.id,
      ])
    })

    describe("GET /admin/products/:id/variant-pricing", () => {
      it("lists every variant with unset values as null", async () => {
        const { product, variants } = await createProduct()

        const res = await getPricing(product.id)

        expect(res.status).toBe(200)
        expect(res.data.variant_pricing).toEqual({
          product_id: product.id,
          currency_code: "eur",
          // Both variants have the same rank, so their order isn't asserted.
          variants: expect.arrayContaining([
            {
              variant_id: variants.S.id,
              title: "S",
              sku: "Shirt-S",
              price: 10,
              compare_at_amount: null,
              cost_amount: null,
            },
            {
              variant_id: variants.M.id,
              title: "M",
              sku: "Shirt-M",
              price: 20,
              compare_at_amount: null,
              cost_amount: null,
            },
          ]),
        })
        expect(res.data.variant_pricing.variants).toHaveLength(2)
        expect(await listRows([variants.S.id, variants.M.id])).toHaveLength(0)
      })

      it("reports a null price for a variant without a price in the default currency", async () => {
        const { product, variants } = await createProduct("Hat", {
          One: [{ amount: 12, currency_code: "usd" }],
        })

        const res = await getPricing(product.id)

        expect(res.status).toBe(200)
        expect(res.data.variant_pricing.variants).toEqual([
          expect.objectContaining({ variant_id: variants.One.id, price: null }),
        ])
      })

      it("returns 404 for an unknown product", async () => {
        const res = await getPricing("prod_unknown")

        expect(res.status).toBe(404)
      })

      it("returns 401 without auth", async () => {
        const { product } = await createProduct()

        const res = await getPricing(product.id, { headers: {} })

        expect(res.status).toBe(401)
      })
    })

    describe("POST /admin/products/:id/variant-pricing", () => {
      it("sets the compare-at price and cost per item of a variant", async () => {
        const { product, variants } = await createProduct()

        const res = await postPricing(product.id, {
          variants: [
            {
              variant_id: variants.S.id,
              compare_at_amount: 14.99,
              cost_amount: 4.5,
            },
          ],
        })

        expect(res.status).toBe(200)

        const pricing = byVariantId(res.data.variant_pricing.variants)
        expect(pricing[variants.S.id]).toMatchObject({
          price: 10,
          compare_at_amount: 14.99,
          cost_amount: 4.5,
        })
        expect(pricing[variants.M.id]).toMatchObject({
          compare_at_amount: null,
          cost_amount: null,
        })

        const stored = await getPricing(product.id)
        expect(stored.data.variant_pricing).toEqual(res.data.variant_pricing)
      })

      it("sets several variants in one request", async () => {
        const { product, variants } = await createProduct()

        const res = await postPricing(product.id, {
          variants: [
            { variant_id: variants.S.id, cost_amount: 3 },
            { variant_id: variants.M.id, compare_at_amount: 25, cost_amount: 7 },
          ],
        })

        expect(res.status).toBe(200)

        const pricing = byVariantId(res.data.variant_pricing.variants)
        expect(pricing[variants.S.id]).toMatchObject({
          compare_at_amount: null,
          cost_amount: 3,
        })
        expect(pricing[variants.M.id]).toMatchObject({
          compare_at_amount: 25,
          cost_amount: 7,
        })
      })

      it("updates only the fields sent and keeps one row per variant", async () => {
        const { product, variants } = await createProduct()
        await postPricing(product.id, {
          variants: [
            { variant_id: variants.S.id, compare_at_amount: 15, cost_amount: 4 },
          ],
        })

        const res = await postPricing(product.id, {
          variants: [{ variant_id: variants.S.id, cost_amount: 5 }],
        })

        expect(res.status).toBe(200)
        expect(byVariantId(res.data.variant_pricing.variants)[variants.S.id])
          .toMatchObject({ compare_at_amount: 15, cost_amount: 5 })
        expect(await listRows([variants.S.id])).toHaveLength(1)
      })

      it("clears a value sent as null", async () => {
        const { product, variants } = await createProduct()
        await postPricing(product.id, {
          variants: [
            { variant_id: variants.S.id, compare_at_amount: 15, cost_amount: 4 },
          ],
        })

        const res = await postPricing(product.id, {
          variants: [
            {
              variant_id: variants.S.id,
              compare_at_amount: null,
              cost_amount: null,
            },
          ],
        })

        expect(res.status).toBe(200)
        expect(byVariantId(res.data.variant_pricing.variants)[variants.S.id])
          .toMatchObject({ compare_at_amount: null, cost_amount: null })
      })

      it("saves a compare-at price that is not higher than the price", async () => {
        const { product, variants } = await createProduct()

        const res = await postPricing(product.id, {
          variants: [
            { variant_id: variants.S.id, compare_at_amount: 5 },
            { variant_id: variants.M.id, compare_at_amount: 0 },
          ],
        })

        expect(res.status).toBe(200)

        const pricing = byVariantId(res.data.variant_pricing.variants)
        expect(pricing[variants.S.id].compare_at_amount).toBe(5)
        expect(pricing[variants.M.id].compare_at_amount).toBe(0)
      })

      it("creates a single row when two first edits race", async () => {
        const { product, variants } = await createProduct()

        const results = await Promise.all([
          postPricing(product.id, {
            variants: [{ variant_id: variants.S.id, compare_at_amount: 15 }],
          }),
          postPricing(product.id, {
            variants: [{ variant_id: variants.S.id, cost_amount: 4 }],
          }),
        ])

        expect(results.map((res) => res.status)).toEqual([200, 200])

        const rows = await listRows([variants.S.id])
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ compare_at_amount: 15, cost_amount: 4 })
      })

      it.each([
        ["an empty body", {}],
        ["no variants", { variants: [] }],
        ["a variant without amounts", { variants: [{ variant_id: "S" }] }],
        ["a negative amount", { variants: [{ variant_id: "S", cost_amount: -1 }] }],
        [
          "an amount sent as a string",
          { variants: [{ variant_id: "S", compare_at_amount: "15" }] },
        ],
        [
          "the same variant twice",
          {
            variants: [
              { variant_id: "S", cost_amount: 1 },
              { variant_id: "S", cost_amount: 2 },
            ],
          },
        ],
        [
          "an unknown field",
          { variants: [{ variant_id: "S", cost_amount: 1, currency_code: "usd" }] },
        ],
      ])("returns 400 for %s and stores nothing", async (_, body) => {
        const { product, variants } = await createProduct()
        // "S" stands for the real id of variant S.
        const payload = JSON.parse(
          JSON.stringify(body).replace(/"S"/g, `"${variants.S.id}"`)
        )

        const res = await postPricing(product.id, payload)

        expect(res.status).toBe(400)
        expect(await listRows([variants.S.id])).toHaveLength(0)
      })

      it("returns 404 for an unknown product and stores nothing", async () => {
        const { variants } = await createProduct()

        const res = await postPricing("prod_unknown", {
          variants: [{ variant_id: variants.S.id, cost_amount: 4 }],
        })

        expect(res.status).toBe(404)
        expect(await listRows([variants.S.id])).toHaveLength(0)
      })

      it("returns 404 for another product's variant and stores nothing", async () => {
        const { product, variants } = await createProduct("Shirt")
        const { variants: otherVariants } = await createProduct("Pants")

        const res = await postPricing(product.id, {
          variants: [
            { variant_id: variants.S.id, cost_amount: 4 },
            { variant_id: otherVariants.S.id, cost_amount: 5 },
          ],
        })

        expect(res.status).toBe(404)
        expect(res.data.message).toContain(otherVariants.S.id)
        expect(
          await listRows([variants.S.id, otherVariants.S.id])
        ).toHaveLength(0)
      })

      it("returns 401 without auth and stores nothing", async () => {
        const { product, variants } = await createProduct()

        const res = await postPricing(
          product.id,
          { variants: [{ variant_id: variants.S.id, cost_amount: 4 }] },
          { headers: {} }
        )

        expect(res.status).toBe(401)
        expect(await listRows([variants.S.id])).toHaveLength(0)
      })
    })

    describe("upsert-variant-price-details compensation", () => {
      const runAndFail = async (input: UpsertVariantPriceDetailsStepInput) => {
        const { errors } = await upsertThenFailWorkflow(getContainer()).run({
          input,
          throwOnError: false,
        })

        expect(errors[0]?.error?.message).toBe("Later step failed")
      }

      it("removes the rows a failed first edit created and restores edited ones", async () => {
        const { product, variants } = await createProduct()
        await postPricing(product.id, {
          variants: [
            { variant_id: variants.S.id, compare_at_amount: 15, cost_amount: 4 },
          ],
        })

        await runAndFail([
          { variant_id: variants.S.id, compare_at_amount: null, cost_amount: 9 },
          { variant_id: variants.M.id, cost_amount: 7 },
        ])

        const rows = await listRows([variants.S.id, variants.M.id])
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({
          variant_id: variants.S.id,
          compare_at_amount: 15,
          cost_amount: 4,
        })
      })
    })

    describe("store responses", () => {
      // S: compare-at 15 > price 10 (a sale). M: compare-at 20 = price 20.
      const setUpShirt = async () => {
        const shirt = await createProduct()
        await postPricing(shirt.product.id, {
          variants: [
            { variant_id: shirt.variants.S.id, compare_at_amount: 15, cost_amount: 4 },
            { variant_id: shirt.variants.M.id, compare_at_amount: 20, cost_amount: 8 },
          ],
        })
        return shirt
      }

      it("GET /store/products/:id shows only compare-at prices above the price, never the cost", async () => {
        const { product, variants } = await setUpShirt()

        const res = await getStore(
          `/store/products/${product.id}?region_id=${region.id}`
        )

        expect(res.status).toBe(200)

        const storeVariants = byVariantId(res.data.product.variants)
        expect(storeVariants[variants.S.id].compare_at_amount).toBe(15)
        expect(storeVariants[variants.M.id].compare_at_amount).toBeNull()
        expect(JSON.stringify(res.data)).not.toContain("cost_amount")
      })

      it("GET /store/products/:id hides a compare-at price lower than the price", async () => {
        const { product, variants } = await createProduct()
        await postPricing(product.id, {
          variants: [{ variant_id: variants.M.id, compare_at_amount: 15 }],
        })

        const res = await getStore(`/store/products/${product.id}`)

        expect(byVariantId(res.data.product.variants)[variants.M.id])
          .toMatchObject({ compare_at_amount: null })
      })

      it("GET /store/products/:id has null compare-at prices when none is set", async () => {
        const { product } = await createProduct()

        const res = await getStore(`/store/products/${product.id}`)

        expect(res.status).toBe(200)
        expect(
          res.data.product.variants.map((variant) => variant.compare_at_amount)
        ).toEqual([null, null])
      })

      it("GET /store/products/:id hides the compare-at price of a variant without a default-currency price", async () => {
        const { product, variants } = await createProduct("Hat", {
          One: [{ amount: 12, currency_code: "usd" }],
        })
        await postPricing(product.id, {
          variants: [{ variant_id: variants.One.id, compare_at_amount: 50 }],
        })

        const res = await getStore(`/store/products/${product.id}`)

        expect(res.data.product.variants[0].compare_at_amount).toBeNull()
      })

      it("GET /store/products adds compare-at prices to every product's variants", async () => {
        const shirt = await setUpShirt()
        const hat = await createProduct("Hat", {
          One: [{ amount: 30, currency_code: "eur" }],
        })
        await postPricing(hat.product.id, {
          variants: [{ variant_id: hat.variants.One.id, compare_at_amount: 45 }],
        })

        const res = await getStore(`/store/products?region_id=${region.id}`)

        expect(res.status).toBe(200)

        const storeVariants = byVariantId(
          res.data.products.flatMap((product) => product.variants)
        )
        expect(storeVariants[shirt.variants.S.id].compare_at_amount).toBe(15)
        expect(storeVariants[shirt.variants.M.id].compare_at_amount).toBeNull()
        expect(storeVariants[hat.variants.One.id].compare_at_amount).toBe(45)
        expect(JSON.stringify(res.data)).not.toContain("cost_amount")
      })

      it("GET /store/products without variants in fields still answers", async () => {
        const { product } = await setUpShirt()

        const res = await getStore("/store/products?fields=id")

        expect(res.status).toBe(200)
        expect(res.data.products.map((item) => item.id)).toEqual([product.id])
        expect(res.data.products[0].variants).toBeUndefined()
      })

      it("never exposes the cost through fields", async () => {
        const { product } = await setUpShirt()

        const res = await getStore(
          `/store/products/${product.id}?fields=*variants.variant_price_detail`
        )

        expect(JSON.stringify(res.data)).not.toContain("cost_amount")
        expect(JSON.stringify(res.data)).not.toContain('"cost')
      })

      it("GET /store/product-variants and /:id add compare-at prices", async () => {
        const { variants } = await setUpShirt()

        const list = await getStore(
          `/store/product-variants?region_id=${region.id}`
        )

        expect(list.status).toBe(200)

        const listed = byVariantId(list.data.variants)
        expect(listed[variants.S.id].compare_at_amount).toBe(15)
        expect(listed[variants.M.id].compare_at_amount).toBeNull()

        const single = await getStore(
          `/store/product-variants/${variants.S.id}?region_id=${region.id}`
        )

        expect(single.status).toBe(200)
        expect(single.data.variant.compare_at_amount).toBe(15)
        expect(JSON.stringify([list.data, single.data])).not.toContain(
          "cost_amount"
        )
      })

      it("GET /store/brands/:id/products adds compare-at prices", async () => {
        const brandRes = await api.post(
          "/admin/brands",
          { name: "Nike" },
          adminHeaders
        )
        const { product, variants } = await setUpShirt()
        await getContainer()
          .resolve(ContainerRegistrationKeys.LINK)
          .create({
            [Modules.PRODUCT]: { product_id: product.id },
            [BRAND_MODULE]: { brand_id: brandRes.data.brand.id },
          })

        const res = await getStore(
          `/store/brands/${brandRes.data.brand.id}/products?region_id=${region.id}`
        )

        expect(res.status).toBe(200)

        const storeVariants = byVariantId(res.data.products[0].variants)
        expect(storeVariants[variants.S.id].compare_at_amount).toBe(15)
        expect(storeVariants[variants.M.id].compare_at_amount).toBeNull()
      })

      it("GET /store/products/:id keeps the SEO values next to compare-at prices", async () => {
        const { product, variants } = await setUpShirt()

        const res = await getStore(`/store/products/${product.id}`)

        expect(res.data.product.seo).toEqual({
          title: "Shirt",
          description: null,
        })
        expect(byVariantId(res.data.product.variants)[variants.S.id])
          .toMatchObject({ compare_at_amount: 15 })
      })

      it("GET /store/products/:id still returns 404 for an unknown product", async () => {
        const res = await getStore("/store/products/prod_unknown")

        expect(res.status).toBe(404)
        expect(res.data.product).toBeUndefined()
      })
    })
  },
})
