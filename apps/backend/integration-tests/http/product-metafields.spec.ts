import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createSalesChannelsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  createStep,
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../src/modules/metafield"
import MetafieldModuleService from "../../src/modules/metafield/service"
import {
  deleteMetafieldValuesStep,
  DeleteMetafieldValuesStepInput,
} from "../../src/workflows/metafield/steps/delete-metafield-values"
import {
  upsertMetafieldValuesStep,
  UpsertMetafieldValuesStepInput,
} from "../../src/workflows/metafield/steps/upsert-metafield-values"
import { createAdminUser } from "../helpers/admin-auth"
import { createPublishableKeyHeaders } from "../helpers/publishable-key"

jest.setTimeout(60 * 1000)

// Runs a step and then fails, so the step's compensation runs.
const failStep = createStep("test-fail-after-metafield-step", async () => {
  throw new Error("Later step failed")
})

const upsertThenFailWorkflow = createWorkflow(
  "test-upsert-metafield-values-then-fail",
  function (input: UpsertMetafieldValuesStepInput) {
    upsertMetafieldValuesStep(input)
    failStep()

    return new WorkflowResponse(input)
  }
)

const deleteThenFailWorkflow = createWorkflow(
  "test-delete-metafield-values-then-fail",
  function (input: DeleteMetafieldValuesStepInput) {
    deleteMetafieldValuesStep(input)
    failStep()

    return new WorkflowResponse(input)
  }
)

type Headers = { headers: Record<string, string> }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: Headers
    let storeHeaders: Headers
    let webChannel: { id: string }
    let otherChannel: { id: string }

    let productCount = 0

    const createProduct = async ({
      status = "published",
      channelId,
    }: { status?: "published" | "draft"; channelId?: string } = {}) => {
      const {
        result: [product],
      } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              // Unique, so each product gets its own handle.
              title: `Shirt ${++productCount}`,
              status,
              sales_channels: [{ id: channelId ?? webChannel.id }],
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

    const createDefinition = async (body: Record<string, unknown>) => {
      const res = await api.post(
        "/admin/metafield-definitions",
        { label: "Label", type: "text", owner_type: "product", ...body },
        adminHeaders
      )
      return res.data.metafield_definition
    }

    const postDefinition = (body: Record<string, unknown>) =>
      api
        .post(
          "/admin/metafield-definitions",
          { label: "Label", type: "text", owner_type: "product", ...body },
          adminHeaders
        )
        .catch((e) => e.response)

    const deleteDefinition = (id: string, query = "") =>
      api
        .delete(`/admin/metafield-definitions/${id}${query}`, adminHeaders)
        .catch((e) => e.response)

    const metafieldsPath = (productId: string) =>
      `/admin/products/${productId}/metafields`

    const getMetafields = (productId: string, headers: unknown = adminHeaders) =>
      api.get(metafieldsPath(productId), headers).catch((e) => e.response)

    const setMetafields = (
      productId: string,
      metafields: unknown,
      headers: unknown = adminHeaders
    ) =>
      api
        .post(metafieldsPath(productId), { metafields }, headers)
        .catch((e) => e.response)

    const deleteMetafield = (
      productId: string,
      key: string,
      headers: unknown = adminHeaders
    ) =>
      api
        .delete(`${metafieldsPath(productId)}/${key}`, headers)
        .catch((e) => e.response)

    const getStoreMetafields = (
      productId: string,
      query: string,
      headers: unknown = storeHeaders
    ) =>
      api
        .get(`/store/products/${productId}/metafields${query}`, headers)
        .catch((e) => e.response)

    const metafieldService = () =>
      getContainer().resolve<MetafieldModuleService>(METAFIELD_MODULE)

    const listStoredValues = (productId: string) =>
      metafieldService().listMetafieldValues(
        { owner_type: "product", owner_id: productId },
        { order: { key: "ASC" } }
      )

    // A product with an unstructured `legacy` value: its definition was
    // deleted and the value kept.
    const createUnstructured = async (
      productId: string,
      { type = "text", value }: { type?: string; value: unknown } = {
        value: "Old",
      },
      extra: Record<string, unknown> = {}
    ) => {
      const definition = await createDefinition({ key: "legacy", type, ...extra })
      await setMetafields(productId, [{ key: "legacy", value }])
      await deleteDefinition(definition.id)
      return definition
    }

    beforeEach(async () => {
      const container = getContainer()
      adminHeaders = await createAdminUser(api, container)

      const { result: channels } = await createSalesChannelsWorkflow(
        container
      ).run({
        input: { salesChannelsData: [{ name: "Web" }, { name: "Other" }] },
      })
      webChannel = channels[0]
      otherChannel = channels[1]

      storeHeaders = await createPublishableKeyHeaders(container, [
        webChannel.id,
      ])
    })

    describe("POST /admin/products/:id/metafields", () => {
      it("sets a value of each type and returns them typed, with their definitions", async () => {
        const product = await createProduct()
        const fabric = await createDefinition({ key: "fabric" })
        await createDefinition({ key: "weight", type: "number" })
        await createDefinition({ key: "organic", type: "boolean" })
        await createDefinition({
          key: "fit",
          type: "select",
          options: ["slim", "regular"],
        })

        const res = await setMetafields(product.id, [
          { key: "fabric", value: "Cotton" },
          { key: "weight", value: 1.5 },
          { key: "organic", value: false },
          { key: "fit", value: "slim" },
        ])

        expect(res.status).toBe(200)
        expect(res.data.metafields.map((m: any) => [m.key, m.type, m.value])).toEqual([
          ["fabric", "text", "Cotton"],
          ["fit", "select", "slim"],
          ["organic", "boolean", false],
          ["weight", "number", 1.5],
        ])
        expect(res.data.metafields[0]).toEqual({
          id: expect.stringMatching(/^mfval_/),
          key: "fabric",
          type: "text",
          value: "Cotton",
          definition: {
            id: fabric.id,
            label: "Label",
            type: "text",
            options: null,
            storefront_access: false,
          },
          created_at: expect.any(String),
          updated_at: expect.any(String),
        })

        const stored = await getMetafields(product.id)
        expect(stored.data.metafields).toEqual(res.data.metafields)
      })

      it("updates a value and keeps the keys left out", async () => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })
        await createDefinition({ key: "care" })
        await setMetafields(product.id, [
          { key: "fabric", value: "Cotton" },
          { key: "care", value: "Hand wash" },
        ])

        const res = await setMetafields(product.id, [
          { key: "fabric", value: "Wool" },
        ])

        expect(res.status).toBe(200)
        expect(
          res.data.metafields.map((m: any) => [m.key, m.value])
        ).toEqual([
          ["care", "Hand wash"],
          ["fabric", "Wool"],
        ])
        expect(await listStoredValues(product.id)).toHaveLength(2)
      })

      it("keeps values per product", async () => {
        const first = await createProduct()
        const second = await createProduct()
        await createDefinition({ key: "fabric" })

        await setMetafields(first.id, [{ key: "fabric", value: "Cotton" }])
        await setMetafields(second.id, [{ key: "fabric", value: "Wool" }])

        const res = await getMetafields(first.id)

        expect(res.data.metafields.map((m: any) => m.value)).toEqual(["Cotton"])
      })

      it("returns 400 for a value that doesn't match the definition's type", async () => {
        const product = await createProduct()
        await createDefinition({ key: "weight", type: "number" })

        const res = await setMetafields(product.id, [
          { key: "weight", value: "heavy" },
        ])

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          'Metafield weight is of type number and needs a number value, received "heavy"'
        )
      })

      it("returns 400 for a select value outside the definition's options", async () => {
        const product = await createProduct()
        await createDefinition({
          key: "fit",
          type: "select",
          options: ["slim", "regular"],
        })

        const res = await setMetafields(product.id, [
          { key: "fit", value: "baggy" },
        ])

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          'Metafield fit must be one of its options: "slim", "regular"'
        )
      })

      it("returns 400 for a key without a definition or value", async () => {
        const product = await createProduct()

        const res = await setMetafields(product.id, [
          { key: "fabric", value: "Cotton" },
        ])

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          "No metafield definition with key fabric exists for owner type product"
        )
      })

      it("stores nothing when one of the values is invalid", async () => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })
        await createDefinition({ key: "weight", type: "number" })

        const res = await setMetafields(product.id, [
          { key: "fabric", value: "Cotton" },
          { key: "weight", value: "heavy" },
        ])

        expect(res.status).toBe(400)
        expect(await listStoredValues(product.id)).toHaveLength(0)
      })

      it.each([
        ["an empty list", []],
        ["a null value", [{ key: "fabric", value: null }]],
        [
          "a repeated key",
          [
            { key: "fabric", value: "Cotton" },
            { key: "fabric", value: "Wool" },
          ],
        ],
      ])("returns 400 for %s", async (_, metafields) => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })

        const res = await setMetafields(product.id, metafields)

        expect(res.status).toBe(400)
      })

      it("returns 404 for an unknown product and stores nothing", async () => {
        await createDefinition({ key: "fabric" })

        const res = await setMetafields("prod_unknown", [
          { key: "fabric", value: "Cotton" },
        ])

        expect(res.status).toBe(404)
        expect(await listStoredValues("prod_unknown")).toHaveLength(0)
      })

      it("returns 401 without authentication", async () => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })

        const res = await setMetafields(
          product.id,
          [{ key: "fabric", value: "Cotton" }],
          {}
        )

        expect(res.status).toBe(401)
        expect(await listStoredValues(product.id)).toHaveLength(0)
      })

      it("creates a single value when two first edits race", async () => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })

        const results = await Promise.all([
          setMetafields(product.id, [{ key: "fabric", value: "Cotton" }]),
          setMetafields(product.id, [{ key: "fabric", value: "Wool" }]),
        ])

        expect(results.map((r) => r.status)).toEqual([200, 200])
        const stored = await listStoredValues(product.id)
        expect(stored).toHaveLength(1)
        expect(["Cotton", "Wool"]).toContain(stored[0].value)
      })
    })

    describe("GET /admin/products/:id/metafields", () => {
      it("returns an empty list for a product without values", async () => {
        const product = await createProduct()

        const res = await getMetafields(product.id)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({ metafields: [] })
      })

      it("shows an unstructured value without a definition", async () => {
        const product = await createProduct()
        await createUnstructured(product.id)

        const res = await getMetafields(product.id)

        expect(res.data.metafields).toEqual([
          expect.objectContaining({
            key: "legacy",
            type: "text",
            value: "Old",
            definition: null,
          }),
        ])
      })

      it("returns 404 for an unknown product", async () => {
        const res = await getMetafields("prod_unknown")

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const product = await createProduct()

        const res = await getMetafields(product.id, {})

        expect(res.status).toBe(401)
      })
    })

    describe("DELETE /admin/products/:id/metafields/:key", () => {
      it("deletes one of the product's values", async () => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })
        await createDefinition({ key: "care" })
        await setMetafields(product.id, [
          { key: "fabric", value: "Cotton" },
          { key: "care", value: "Hand wash" },
        ])

        const res = await deleteMetafield(product.id, "fabric")

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          key: "fabric",
          object: "metafield",
          deleted: true,
        })

        const after = await getMetafields(product.id)
        expect(after.data.metafields.map((m: any) => m.key)).toEqual(["care"])
      })

      it("deletes an unstructured value", async () => {
        const product = await createProduct()
        await createUnstructured(product.id)

        const res = await deleteMetafield(product.id, "legacy")

        expect(res.status).toBe(200)
        expect(await listStoredValues(product.id)).toHaveLength(0)
      })

      it("returns 404 for a key without a value", async () => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })

        const res = await deleteMetafield(product.id, "fabric")

        expect(res.status).toBe(404)
        expect(res.data.message).toBe(
          `Metafield fabric has no value for product ${product.id}`
        )
      })

      it("returns 404 for an unknown product", async () => {
        const res = await deleteMetafield("prod_unknown", "fabric")

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })
        await setMetafields(product.id, [{ key: "fabric", value: "Cotton" }])

        const res = await deleteMetafield(product.id, "fabric", {})

        expect(res.status).toBe(401)
        expect(await listStoredValues(product.id)).toHaveLength(1)
      })
    })

    describe("definition lifecycle", () => {
      it("keeps the values when a definition is deleted", async () => {
        const product = await createProduct()
        const definition = await createDefinition({ key: "fabric" })
        await setMetafields(product.id, [{ key: "fabric", value: "Cotton" }])

        const res = await deleteDefinition(definition.id)

        expect(res.status).toBe(200)
        const after = await getMetafields(product.id)
        expect(after.data.metafields).toEqual([
          expect.objectContaining({ key: "fabric", definition: null }),
        ])
      })

      it("deletes the values too with delete_values=true", async () => {
        const product = await createProduct()
        const definition = await createDefinition({ key: "fabric" })
        await setMetafields(product.id, [{ key: "fabric", value: "Cotton" }])

        const res = await deleteDefinition(definition.id, "?delete_values=true")

        expect(res.status).toBe(200)
        expect(await listStoredValues(product.id)).toHaveLength(0)
      })

      it("keeps the values with delete_values=false", async () => {
        const product = await createProduct()
        const definition = await createDefinition({ key: "fabric" })
        await setMetafields(product.id, [{ key: "fabric", value: "Cotton" }])

        await deleteDefinition(definition.id, "?delete_values=false")

        expect(await listStoredValues(product.id)).toHaveLength(1)
      })

      it("reconnects kept values to a new definition of the same type", async () => {
        const product = await createProduct()
        await createUnstructured(product.id)

        const res = await postDefinition({ key: "legacy", label: "Legacy" })

        expect(res.status).toBe(200)
        const after = await getMetafields(product.id)
        expect(after.data.metafields).toEqual([
          expect.objectContaining({
            key: "legacy",
            value: "Old",
            definition: expect.objectContaining({
              id: res.data.metafield_definition.id,
            }),
          }),
        ])
      })

      it("returns 409 for a new definition of another type, saying so", async () => {
        const product = await createProduct()
        await createUnstructured(product.id, { type: "number", value: 3 })

        const res = await postDefinition({ key: "legacy", type: "text" })

        expect(res.status).toBe(409)
        expect(res.data).toEqual({
          type: "conflict",
          message:
            "Metafield definition legacy can't be of type text: existing values with this key are of type number",
        })

        const definitions = await api.get(
          "/admin/metafield-definitions",
          adminHeaders
        )
        expect(definitions.data.count).toBe(0)
      })

      it("returns 409 for a select whose options leave out an existing value", async () => {
        const product = await createProduct()
        await createUnstructured(
          product.id,
          { type: "select", value: "slim" },
          { options: ["slim", "regular"] }
        )

        const res = await postDefinition({
          key: "legacy",
          type: "select",
          options: ["regular"],
        })

        expect(res.status).toBe(409)
        expect(res.data.message).toBe(
          'Metafield definition legacy needs every existing value among its options; missing: "slim"'
        )
      })

      it("reconnects select values found among the new options", async () => {
        const product = await createProduct()
        await createUnstructured(
          product.id,
          { type: "select", value: "slim" },
          { options: ["slim"] }
        )

        const res = await postDefinition({
          key: "legacy",
          type: "select",
          options: ["regular", "slim"],
        })

        expect(res.status).toBe(200)
      })

      it("ignores values of deleted keys when checking a new definition", async () => {
        const product = await createProduct()
        const definition = await createDefinition({ key: "fabric", type: "number" })
        await setMetafields(product.id, [{ key: "fabric", value: 3 }])
        await deleteDefinition(definition.id, "?delete_values=true")

        const res = await postDefinition({ key: "fabric", type: "text" })

        expect(res.status).toBe(200)
      })

      it("checks an unstructured edit against the stored type", async () => {
        const product = await createProduct()
        await createUnstructured(product.id, { type: "number", value: 3 })

        const valid = await setMetafields(product.id, [
          { key: "legacy", value: 4 },
        ])
        const invalid = await setMetafields(product.id, [
          { key: "legacy", value: "four" },
        ])

        expect(valid.status).toBe(200)
        expect(valid.data.metafields).toEqual([
          expect.objectContaining({ key: "legacy", value: 4, definition: null }),
        ])
        expect(invalid.status).toBe(400)
      })

      it("checks an unstructured select edit as plain text", async () => {
        const product = await createProduct()
        await createUnstructured(
          product.id,
          { type: "select", value: "slim" },
          { options: ["slim"] }
        )

        const res = await setMetafields(product.id, [
          { key: "legacy", value: "anything" },
        ])

        expect(res.status).toBe(200)
        expect(res.data.metafields[0]).toMatchObject({
          type: "select",
          value: "anything",
        })
      })
    })

    describe("GET /admin/metafields/unstructured/:owner_type", () => {
      it("lists the keys without a definition, with their value counts", async () => {
        const first = await createProduct()
        const second = await createProduct()
        await createDefinition({ key: "fabric" })
        await setMetafields(first.id, [{ key: "fabric", value: "Cotton" }])
        const legacy = await createDefinition({ key: "legacy", type: "number" })
        await setMetafields(first.id, [{ key: "legacy", value: 1 }])
        await setMetafields(second.id, [{ key: "legacy", value: 2 }])
        await deleteDefinition(legacy.id)

        const res = await api.get(
          "/admin/metafields/unstructured/product",
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          unstructured_metafields: [
            {
              owner_type: "product",
              key: "legacy",
              type: "number",
              values_count: 2,
            },
          ],
          count: 1,
          offset: 0,
          limit: 20,
        })
      })

      it("paginates", async () => {
        const product = await createProduct()
        for (const key of ["a_key", "b_key"]) {
          const definition = await createDefinition({ key })
          await setMetafields(product.id, [{ key, value: "x" }])
          await deleteDefinition(definition.id)
        }

        const res = await api.get(
          "/admin/metafields/unstructured/product?limit=1&offset=1",
          adminHeaders
        )

        expect(res.data).toEqual(
          expect.objectContaining({ count: 2, offset: 1, limit: 1 })
        )
        expect(
          res.data.unstructured_metafields.map((m: any) => m.key)
        ).toEqual(["b_key"])
      })

      it("returns 400 for an owner type that is not allowed", async () => {
        const res = await api
          .get("/admin/metafields/unstructured/customer", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          "Owner type customer is not allowed. Allowed owner types: product"
        )
      })

      it("returns 400 for an invalid limit", async () => {
        const res = await api
          .get("/admin/metafields/unstructured/product?limit=abc", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 401 without authentication", async () => {
        const res = await api
          .get("/admin/metafields/unstructured/product")
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("DELETE /admin/metafields/unstructured/:owner_type/:key", () => {
      const deleteUnstructured = (path: string, headers: unknown = adminHeaders) =>
        api
          .delete(`/admin/metafields/unstructured/${path}`, headers)
          .catch((e) => e.response)

      it("deletes every value of the key", async () => {
        const first = await createProduct()
        const second = await createProduct()
        const definition = await createDefinition({ key: "legacy" })
        await setMetafields(first.id, [{ key: "legacy", value: "a" }])
        await setMetafields(second.id, [{ key: "legacy", value: "b" }])
        await deleteDefinition(definition.id)

        const res = await deleteUnstructured("product/legacy")

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          owner_type: "product",
          key: "legacy",
          object: "unstructured_metafield",
          deleted: true,
          values_deleted: 2,
        })
        expect(await listStoredValues(first.id)).toHaveLength(0)
        expect(await listStoredValues(second.id)).toHaveLength(0)
      })

      it("returns 400 for a key that has a definition and keeps its values", async () => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })
        await setMetafields(product.id, [{ key: "fabric", value: "Cotton" }])

        const res = await deleteUnstructured("product/fabric")

        expect(res.status).toBe(400)
        expect(await listStoredValues(product.id)).toHaveLength(1)
      })

      it("returns 404 for a key without values", async () => {
        const res = await deleteUnstructured("product/legacy")

        expect(res.status).toBe(404)
      })

      it("returns 400 for an owner type that is not allowed", async () => {
        const res = await deleteUnstructured("customer/legacy")

        expect(res.status).toBe(400)
      })

      it("returns 401 without authentication", async () => {
        const product = await createProduct()
        await createUnstructured(product.id)

        const res = await deleteUnstructured("product/legacy", {})

        expect(res.status).toBe(401)
        expect(await listStoredValues(product.id)).toHaveLength(1)
      })
    })

    describe("GET /store/products/:id/metafields", () => {
      const setUpProduct = async () => {
        const product = await createProduct()
        const publicFabric = await createDefinition({ key: "fabric" })
        const weight = await createDefinition({ key: "weight", type: "number" })
        const organic = await createDefinition({
          key: "organic",
          type: "boolean",
        })
        await createDefinition({ key: "care" })
        const note = await createDefinition({ key: "note" })
        for (const definition of [publicFabric, weight, organic, note]) {
          await api.post(
            `/admin/metafield-definitions/${definition.id}`,
            { storefront_access: true },
            adminHeaders
          )
        }
        await setMetafields(product.id, [
          { key: "fabric", value: "Cotton" },
          { key: "weight", value: 1.5 },
          { key: "organic", value: false },
          { key: "care", value: "Hand wash" },
          { key: "note", value: "" },
        ])
        return product
      }

      it("returns every requested key, null when missing, empty or private", async () => {
        const product = await setUpProduct()

        const res = await getStoreMetafields(
          product.id,
          "?keys=fabric,weight,organic,care,note,missing"
        )

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          metafields: {
            fabric: "Cotton",
            weight: 1.5,
            organic: false,
            care: null,
            note: null,
            missing: null,
          },
        })
      })

      it("accepts repeated keys params", async () => {
        const product = await setUpProduct()

        const res = await getStoreMetafields(
          product.id,
          "?keys=fabric&keys=weight"
        )

        expect(res.data.metafields).toEqual({ fabric: "Cotton", weight: 1.5 })
      })

      it("never returns unstructured values", async () => {
        const product = await createProduct()
        const definition = await createDefinition({ key: "legacy" })
        await api.post(
          `/admin/metafield-definitions/${definition.id}`,
          { storefront_access: true },
          adminHeaders
        )
        await setMetafields(product.id, [{ key: "legacy", value: "Old" }])
        await deleteDefinition(definition.id)

        const res = await getStoreMetafields(product.id, "?keys=legacy")

        expect(res.data.metafields).toEqual({ legacy: null })
      })

      it("keeps values out of the default product payload", async () => {
        const product = await setUpProduct()

        const res = await api.get(`/store/products/${product.id}`, storeHeaders)

        expect(res.status).toBe(200)
        expect(res.data.product.metafields).toBeUndefined()
        expect(JSON.stringify(res.data.product)).not.toContain("Cotton")
      })

      it("returns 400 without keys", async () => {
        const product = await createProduct()

        const res = await getStoreMetafields(product.id, "")

        expect(res.status).toBe(400)
      })

      it("returns 404 for an unknown product", async () => {
        const res = await getStoreMetafields("prod_unknown", "?keys=fabric")

        expect(res.status).toBe(404)
      })

      it("returns 404 for a draft product", async () => {
        const product = await createProduct({ status: "draft" })

        const res = await getStoreMetafields(product.id, "?keys=fabric")

        expect(res.status).toBe(404)
      })

      it("returns 404 for a product outside the key's sales channels", async () => {
        const product = await createProduct({ channelId: otherChannel.id })

        const res = await getStoreMetafields(product.id, "?keys=fabric")

        expect(res.status).toBe(404)
      })

      it("requires a publishable key", async () => {
        const product = await createProduct()

        const res = await getStoreMetafields(product.id, "?keys=fabric", {
          headers: {},
        })

        expect(res.status).toBe(400)
      })
    })

    describe("definition changes and value edits of one key run one at a time", () => {
      const TEST_LOCK_OWNER = "test-lock-owner"
      const LEGACY_LOCK = "metafield:product:legacy"

      const locking = () => getContainer().resolve(Modules.LOCKING)

      // Settles `request` only once the test releases the key's lock, and
      // checks it was still waiting meanwhile.
      const whileLocked = async (
        start: () => Promise<any>,
        meanwhile: () => Promise<unknown>
      ): Promise<any> => {
        await locking().acquire(LEGACY_LOCK, { ownerId: TEST_LOCK_OWNER })

        let settled = false
        const request = start().finally(() => {
          settled = true
        })

        try {
          await new Promise((resolve) => setTimeout(resolve, 500))
          expect(settled).toBe(false)
          await meanwhile()
        } finally {
          await locking().release(LEGACY_LOCK, { ownerId: TEST_LOCK_OWNER })
        }

        return request
      }

      it("checks a new definition against an edit that landed while it waited", async () => {
        const product = await createProduct()
        await createUnstructured(
          product.id,
          { type: "select", value: "slim" },
          { options: ["slim", "baggy"] }
        )
        const [stored] = await listStoredValues(product.id)

        const res = await whileLocked(
          () => postDefinition({ key: "legacy", type: "select", options: ["slim"] }),
          // An edit holding the lock saves its value.
          () =>
            metafieldService().updateMetafieldValues({
              id: stored.id,
              value: "baggy",
            })
        )

        expect(res.status).toBe(409)
        const definitions = await api.get(
          "/admin/metafield-definitions",
          adminHeaders
        )
        expect(definitions.data.count).toBe(0)
      })

      it("checks an edit against a definition created while it waited", async () => {
        const product = await createProduct()
        await createUnstructured(
          product.id,
          { type: "select", value: "slim" },
          { options: ["slim", "baggy"] }
        )

        const res = await whileLocked(
          () => setMetafields(product.id, [{ key: "legacy", value: "baggy" }]),
          // A definition creation holding the lock reconnects the value.
          () =>
            metafieldService().createMetafieldDefinitions({
              key: "legacy",
              label: "Legacy",
              type: "select",
              options: ["slim"] as unknown as Record<string, unknown>,
              owner_type: "product",
            })
        )

        expect(res.status).toBe(400)
        const [stored] = await listStoredValues(product.id)
        expect(stored.value).toBe("slim")
      })

      it("keeps reconnection waiting until a prepared unstructured edit is saved", async () => {
        const product = await createProduct()
        await createUnstructured(
          product.id,
          { type: "select", value: "slim" },
          { options: ["slim", "baggy"] }
        )

        let resume!: () => void
        let prepared!: () => void
        const paused = new Promise<void>((resolve) => { prepared = resolve })
        const proceed = new Promise<void>((resolve) => { resume = resolve })
        const service = metafieldService()
        const update = service.updateMetafieldValues.bind(service)
        const spy = jest.spyOn(service, "updateMetafieldValues")
          .mockImplementationOnce(async (...args) => {
            prepared()
            await proceed
            return update(...args)
          })

        const edit = setMetafields(product.id, [{ key: "legacy", value: "baggy" }])
        let reconnect: Promise<any> | undefined
        try {
          await paused
          let settled = false
          reconnect = postDefinition({ key: "legacy", type: "select", options: ["slim"] })
            .finally(() => { settled = true })
          await new Promise((resolve) => setTimeout(resolve, 500))
          expect(settled).toBe(false)
          resume()
          expect((await edit).status).toBe(200)
          expect((await reconnect).status).toBe(409)
          const [stored] = await listStoredValues(product.id)
          expect(stored.value).toBe("baggy")
        } finally {
          resume()
          await edit
          await reconnect
          spy.mockRestore()
        }
      })

      it("releases the lock after a failed run", async () => {
        const product = await createProduct()
        await createDefinition({ key: "weight", type: "number" })

        const failed = await setMetafields(product.id, [
          { key: "weight", value: "heavy" },
        ])
        const next = await setMetafields(product.id, [
          { key: "weight", value: 2 },
        ])

        expect(failed.status).toBe(400)
        expect(next.status).toBe(200)
      })
    })

    describe("compensation", () => {
      it("removes the values a failed first edit created", async () => {
        const product = await createProduct()

        const { errors } = await upsertThenFailWorkflow(getContainer()).run({
          input: {
            owner_type: "product",
            owner_id: product.id,
            values: [{ key: "fabric", type: "text", value: "Cotton" }],
          },
          throwOnError: false,
        })

        expect(errors[0]?.error?.message).toBe("Later step failed")
        expect(await listStoredValues(product.id)).toHaveLength(0)
      })

      it("restores the previous values after a failed edit", async () => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })
        await setMetafields(product.id, [{ key: "fabric", value: "Cotton" }])

        await upsertThenFailWorkflow(getContainer()).run({
          input: {
            owner_type: "product",
            owner_id: product.id,
            values: [
              { key: "fabric", type: "text", value: "Wool" },
              { key: "care", type: "text", value: "Hand wash" },
            ],
          },
          throwOnError: false,
        })

        const stored = await listStoredValues(product.id)
        expect(stored.map((v) => [v.key, v.value])).toEqual([
          ["fabric", "Cotton"],
        ])
      })

      it("restores the values a failed delete removed", async () => {
        const product = await createProduct()
        await createDefinition({ key: "fabric" })
        await setMetafields(product.id, [{ key: "fabric", value: "Cotton" }])

        await deleteThenFailWorkflow(getContainer()).run({
          input: { owner_type: "product", key: "fabric" },
          throwOnError: false,
        })

        expect(await listStoredValues(product.id)).toHaveLength(1)
      })
    })
  },
})
