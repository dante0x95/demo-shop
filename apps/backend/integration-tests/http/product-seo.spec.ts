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
import { SEO_MODULE } from "../../src/modules/seo"
import SeoModuleService from "../../src/modules/seo/service"
import {
  upsertProductSeoStep,
  UpsertProductSeoStepInput,
} from "../../src/workflows/seo/steps/upsert-product-seo"
import { createAdminUser } from "../helpers/admin-auth"
import { createPublishableKeyHeaders } from "../helpers/publishable-key"

jest.setTimeout(60 * 1000)

// 40 x "word " is 200 characters; the fallback keeps whole words up to 160.
const LONG_DESCRIPTION = `${"word ".repeat(40)}end`
const LONG_DESCRIPTION_CUT = "word ".repeat(32).trimEnd()

// Runs the upsert step and then fails, so its compensation runs.
const failStep = createStep("test-fail-after-product-seo", async () => {
  throw new Error("Later step failed")
})

const upsertThenFailWorkflow = createWorkflow(
  "test-upsert-product-seo-then-fail",
  function (input: UpsertProductSeoStepInput) {
    upsertProductSeoStep(input)
    failStep()

    return new WorkflowResponse(input)
  }
)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }
    let storeHeaders: { headers: Record<string, string> }
    let region: { id: string }
    let webChannel: { id: string }

    const createProduct = async (
      title: string,
      description: string | null = null
    ) => {
      const {
        result: [product],
      } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title,
              description,
              status: "published",
              sales_channels: [{ id: webChannel.id }],
              options: [{ title: "Size", values: ["M"] }],
              variants: [
                {
                  title: "M",
                  options: { Size: "M" },
                  manage_inventory: false,
                  prices: [{ amount: 10, currency_code: "eur" }],
                },
              ],
            },
          ],
        },
      })
      return product
    }

    const seoPath = (productId: string) => `/admin/products/${productId}/seo`

    const getSeo = (productId: string, headers = adminHeaders) =>
      api.get(seoPath(productId), headers).catch((e) => e.response)

    const postSeo = (
      productId: string,
      body: unknown,
      headers: unknown = adminHeaders
    ) => api.post(seoPath(productId), body, headers).catch((e) => e.response)

    const getStore = (path: string, headers: unknown = storeHeaders) =>
      api.get(path, headers).catch((e) => e.response)

    const listSeoRows = (productId: string) =>
      getContainer()
        .resolve<SeoModuleService>(SEO_MODULE)
        .listProductSeoOverrides({ product_id: productId })

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

    describe("GET /admin/products/:id/seo", () => {
      it("reports unset values as null with the fallbacks resolved", async () => {
        const product = await createProduct("Red Shoes", LONG_DESCRIPTION)

        const res = await getSeo(product.id)

        expect(res.status).toBe(200)
        expect(res.data.product_seo).toEqual({
          product_id: product.id,
          title: null,
          description: null,
          resolved: { title: "Red Shoes", description: LONG_DESCRIPTION_CUT },
        })
        expect(await listSeoRows(product.id)).toHaveLength(0)
      })

      it("returns 404 for an unknown product", async () => {
        const res = await getSeo("prod_unknown")

        expect(res.status).toBe(404)
      })

      it("returns 401 without auth", async () => {
        const product = await createProduct("Red Shoes")

        const res = await getSeo(product.id, { headers: {} } as any)

        expect(res.status).toBe(401)
      })
    })

    describe("POST /admin/products/:id/seo", () => {
      it("sets the SEO title and meta description", async () => {
        const product = await createProduct("Red Shoes", "Comfortable shoes.")

        const res = await postSeo(product.id, {
          title: "  Buy red shoes online ",
          description: "The best red shoes.",
        })

        expect(res.status).toBe(200)
        expect(res.data.product_seo).toEqual({
          product_id: product.id,
          title: "Buy red shoes online",
          description: "The best red shoes.",
          resolved: {
            title: "Buy red shoes online",
            description: "The best red shoes.",
          },
        })

        const stored = await getSeo(product.id)
        expect(stored.data.product_seo).toEqual(res.data.product_seo)
      })

      it("updates only the fields sent", async () => {
        const product = await createProduct("Red Shoes", "Comfortable shoes.")
        await postSeo(product.id, { title: "SEO title", description: "Meta" })

        const res = await postSeo(product.id, { description: "New meta" })

        expect(res.status).toBe(200)
        expect(res.data.product_seo).toMatchObject({
          title: "SEO title",
          description: "New meta",
        })
        expect(await listSeoRows(product.id)).toHaveLength(1)
      })

      it.each([
        ["an empty string", ""],
        ["whitespace only", "  \n\t "],
        ["null", null],
      ])("clears a field sent as %s back to the fallback", async (_, value) => {
        const product = await createProduct("Red Shoes", "Comfortable shoes.")
        await postSeo(product.id, { title: "SEO title", description: "Meta" })

        const res = await postSeo(product.id, {
          title: value,
          description: value,
        })

        expect(res.status).toBe(200)
        expect(res.data.product_seo).toEqual({
          product_id: product.id,
          title: null,
          description: null,
          resolved: { title: "Red Shoes", description: "Comfortable shoes." },
        })
      })

      it("keeps following product renames while the title is unset", async () => {
        const product = await createProduct("Red Shoes")
        await postSeo(product.id, { description: "Meta" })

        await api.post(
          `/admin/products/${product.id}`,
          { title: "Crimson Shoes" },
          adminHeaders
        )

        const res = await getSeo(product.id)

        expect(res.data.product_seo).toMatchObject({
          title: null,
          resolved: { title: "Crimson Shoes", description: "Meta" },
        })
      })

      it("enforces no length limits", async () => {
        const product = await createProduct("Red Shoes")
        const title = "t".repeat(300)
        const description = "d".repeat(1000)

        const res = await postSeo(product.id, { title, description })

        expect(res.status).toBe(200)
        expect(res.data.product_seo.resolved).toEqual({ title, description })
      })

      it("creates a single row when two first edits race", async () => {
        const product = await createProduct("Red Shoes")

        const results = await Promise.all([
          postSeo(product.id, { title: "First" }),
          postSeo(product.id, { description: "Second" }),
        ])

        expect(results.map((res) => res.status)).toEqual([200, 200])

        const rows = await listSeoRows(product.id)
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ title: "First", description: "Second" })
      })

      it.each([
        ["a non-string title", { title: 123 }],
        ["a non-string description", { description: ["meta"] }],
        ["an unknown field", { title: "SEO", handle: "red-shoes" }],
        ["an empty body", {}],
      ])("returns 400 for %s", async (_, body) => {
        const product = await createProduct("Red Shoes")

        const res = await postSeo(product.id, body)

        expect(res.status).toBe(400)
        expect(await listSeoRows(product.id)).toHaveLength(0)
      })

      it("returns 404 for an unknown product and stores nothing", async () => {
        const res = await postSeo("prod_unknown", { title: "SEO" })

        expect(res.status).toBe(404)
        expect(await listSeoRows("prod_unknown")).toHaveLength(0)
      })

      it("returns 401 without auth", async () => {
        const product = await createProduct("Red Shoes")

        const res = await postSeo(product.id, { title: "SEO" }, { headers: {} })

        expect(res.status).toBe(401)
        expect(await listSeoRows(product.id)).toHaveLength(0)
      })
    })

    describe("upsert-product-seo compensation", () => {
      const runAndFail = async (input: UpsertProductSeoStepInput) => {
        const { errors } = await upsertThenFailWorkflow(getContainer()).run({
          input,
          throwOnError: false,
        })

        expect(errors[0]?.error?.message).toBe("Later step failed")
      }

      it("removes the row a failed first edit created", async () => {
        const product = await createProduct("Red Shoes")

        await runAndFail({ product_id: product.id, title: "SEO title" })

        expect(await listSeoRows(product.id)).toHaveLength(0)
      })

      it("restores the previous values after a failed edit", async () => {
        const product = await createProduct("Red Shoes")
        await postSeo(product.id, { title: "Old title", description: "Old" })

        await runAndFail({ product_id: product.id, title: "New", description: "" })

        const rows = await listSeoRows(product.id)
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ title: "Old title", description: "Old" })
      })
    })

    describe("store product responses", () => {
      it("GET /store/products/:id exposes the values the admin set", async () => {
        const product = await createProduct("Red Shoes", "Comfortable shoes.")
        await postSeo(product.id, { title: "SEO title", description: "Meta" })

        const res = await getStore(
          `/store/products/${product.id}?region_id=${region.id}`
        )

        expect(res.status).toBe(200)
        expect(res.data.product.seo).toEqual({
          title: "SEO title",
          description: "Meta",
        })
        expect(res.data.product.product_seo_override).toBeUndefined()
      })

      it("GET /store/products/:id falls back to the product title and cut description", async () => {
        const product = await createProduct("Red Shoes", LONG_DESCRIPTION)

        const res = await getStore(`/store/products/${product.id}`)

        expect(res.status).toBe(200)
        expect(res.data.product.seo).toEqual({
          title: "Red Shoes",
          description: LONG_DESCRIPTION_CUT,
        })
      })

      it("GET /store/products/:id has a null description when the product has none", async () => {
        const product = await createProduct("Red Shoes")

        const res = await getStore(`/store/products/${product.id}`)

        expect(res.data.product.seo).toEqual({
          title: "Red Shoes",
          description: null,
        })
      })

      it("GET /store/products adds SEO to every product, whatever fields were asked for", async () => {
        const edited = await createProduct("Red Shoes", "Comfortable shoes.")
        const unedited = await createProduct("Blue Shoes", "Light shoes.")
        await postSeo(edited.id, { title: "SEO title" })

        const res = await getStore("/store/products?fields=id")

        expect(res.status).toBe(200)

        const seoById = Object.fromEntries(
          res.data.products.map((product) => [product.id, product.seo])
        )

        expect(seoById).toEqual({
          [edited.id]: { title: "SEO title", description: "Comfortable shoes." },
          [unedited.id]: { title: "Blue Shoes", description: "Light shoes." },
        })
      })

      it("GET /store/brands/:id/products adds SEO to the brand's products", async () => {
        const brandRes = await api.post(
          "/admin/brands",
          { name: "Nike" },
          adminHeaders
        )
        const product = await createProduct("Nike Shirt")
        await getContainer()
          .resolve(ContainerRegistrationKeys.LINK)
          .create({
            [Modules.PRODUCT]: { product_id: product.id },
            [BRAND_MODULE]: { brand_id: brandRes.data.brand.id },
          })
        await postSeo(product.id, { description: "Meta" })

        const res = await getStore(
          `/store/brands/${brandRes.data.brand.id}/products?region_id=${region.id}`
        )

        expect(res.status).toBe(200)
        expect(res.data.products[0].seo).toEqual({
          title: "Nike Shirt",
          description: "Meta",
        })
      })

      it("GET /store/products/:id still returns 404 for an unknown product", async () => {
        const res = await getStore("/store/products/prod_unknown")

        expect(res.status).toBe(404)
        expect(res.data.product).toBeUndefined()
      })

      it("GET /store/products/:id still requires a publishable key", async () => {
        const product = await createProduct("Red Shoes")

        const res = await getStore(`/store/products/${product.id}`, {
          headers: {},
        })

        expect(res.status).toBe(400)
      })
    })
  },
})
