import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import productPackagePresetUniqueProduct, {
  PRODUCT_PACKAGE_PRESET_UNIQUE_PRODUCT_INDEX,
} from "@dante0x95/medusa-plugin-package-preset/migration-scripts/product-package-preset-unique-product"
import { createAdminUser } from "../helpers/admin-auth"

jest.setTimeout(60 * 1000)

const PRESET_BODY = {
  length: 30,
  width: 20,
  height: 10,
  dimension_unit: "cm",
  weight: 0.25,
  weight_unit: "kg",
}

type Preset = { id: string; name: string; is_default: boolean }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    const createProduct = async (title = "Shirt") => {
      const {
        result: [product],
      } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title,
              options: [{ title: "Size", values: ["S", "M"] }],
              variants: [
                { title: "S", options: { Size: "S" }, manage_inventory: false },
                { title: "M", options: { Size: "M" }, manage_inventory: false },
              ],
            },
          ],
        },
      })
      return product
    }

    const createPreset = async (
      name: string,
      body: Record<string, unknown> = {}
    ): Promise<Preset> => {
      const res = await api.post(
        "/admin/package-presets",
        { ...PRESET_BODY, name, ...body },
        adminHeaders
      )
      return res.data.package_preset
    }

    const presetPath = (productId: string) =>
      `/admin/products/${productId}/package-preset`

    const getProductPreset = (productId: string, headers: unknown = adminHeaders) =>
      api.get(presetPath(productId), headers).catch((e) => e.response)

    const setProductPreset = (
      productId: string,
      body: unknown,
      headers: unknown = adminHeaders
    ) => api.post(presetPath(productId), body, headers).catch((e) => e.response)

    const linkTableName = async (): Promise<string> => {
      const pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const {
        rows: [{ table_name }],
      } = await pg.raw(
        `SELECT table_name FROM link_module_migrations
         WHERE link_descriptor->>'fromModule' = 'product'
           AND link_descriptor->>'toModel' = 'package_preset'`
      )
      return table_name
    }

    // Reads the link table directly so a duplicate row can't be hidden by
    // query.graph returning a single preset per product.
    const activeLinks = async (productId: string) => {
      const pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const { rows } = await pg.raw(
        `SELECT product_id, package_preset_id FROM ??
         WHERE product_id = ? AND deleted_at IS NULL`,
        [await linkTableName(), productId]
      )
      return rows
    }

    // The test runner syncs links but does not run migration scripts.
    beforeEach(async () => {
      await productPackagePresetUniqueProduct({ container: getContainer() })
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("GET /admin/products/:id/package-preset", () => {
      it("returns no preset when neither the product nor the shop has one", async () => {
        const product = await createProduct()

        const res = await getProductPreset(product.id)

        expect(res.status).toBe(200)
        expect(res.data.product_package_preset).toEqual({
          product_id: product.id,
          package_preset: null,
          resolved: null,
        })
      })

      it("resolves to the store's default preset when the product has none", async () => {
        const product = await createProduct()
        const storeDefault = await createPreset("Default box", {
          is_default: true,
        })

        const res = await getProductPreset(product.id)

        expect(res.status).toBe(200)
        expect(res.data.product_package_preset).toEqual({
          product_id: product.id,
          package_preset: null,
          resolved: expect.objectContaining({
            id: storeDefault.id,
            name: "Default box",
            is_default: true,
          }),
        })
      })

      it("returns 404 for an unknown product", async () => {
        const res = await getProductPreset("prod_unknown")

        expect(res.status).toBe(404)
      })

      it("returns 404 for a deleted product", async () => {
        const product = await createProduct()
        await deleteProductsWorkflow(getContainer()).run({
          input: { ids: [product.id] },
        })

        const res = await getProductPreset(product.id)

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const product = await createProduct()

        const res = await getProductPreset(product.id, { headers: {} })

        expect(res.status).toBe(401)
      })
    })

    describe("POST /admin/products/:id/package-preset", () => {
      it("sets the product's preset over the store default", async () => {
        const product = await createProduct()
        await createPreset("Default box", { is_default: true })
        const small = await createPreset("Small box")

        const res = await setProductPreset(product.id, {
          package_preset_id: ` ${small.id} `,
        })

        expect(res.status).toBe(200)
        expect(res.data.product_package_preset).toEqual({
          product_id: product.id,
          package_preset: {
            id: small.id,
            name: "Small box",
            ...PRESET_BODY,
            is_default: false,
            created_at: expect.any(String),
            updated_at: expect.any(String),
          },
          resolved: expect.objectContaining({ id: small.id }),
        })
        expect(await activeLinks(product.id)).toEqual([
          { product_id: product.id, package_preset_id: small.id },
        ])

        const getRes = await getProductPreset(product.id)
        expect(getRes.data.product_package_preset.resolved.id).toBe(small.id)
      })

      it("shows the preset on the core product route", async () => {
        const product = await createProduct()
        const small = await createPreset("Small box")
        await setProductPreset(product.id, { package_preset_id: small.id })

        const res = await api.get(
          `/admin/products/${product.id}?fields=id,package_preset.id,package_preset.name`,
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.product.package_preset).toEqual({
          id: small.id,
          name: "Small box",
        })
      })

      it("replaces the previous preset", async () => {
        const product = await createProduct()
        const small = await createPreset("Small box")
        const large = await createPreset("Large box")
        await setProductPreset(product.id, { package_preset_id: small.id })

        const res = await setProductPreset(product.id, {
          package_preset_id: large.id,
        })

        expect(res.status).toBe(200)
        expect(res.data.product_package_preset.package_preset.id).toBe(large.id)
        expect(await activeLinks(product.id)).toEqual([
          { product_id: product.id, package_preset_id: large.id },
        ])
      })

      it("keeps a single link when the same preset is set twice", async () => {
        const product = await createProduct()
        const small = await createPreset("Small box")

        await setProductPreset(product.id, { package_preset_id: small.id })
        const res = await setProductPreset(product.id, {
          package_preset_id: small.id,
        })

        expect(res.status).toBe(200)
        expect(res.data.product_package_preset.package_preset.id).toBe(small.id)
        expect(await activeLinks(product.id)).toHaveLength(1)
      })

      it("lets one preset pack several products", async () => {
        const [shirt, hat] = [
          await createProduct("Shirt"),
          await createProduct("Hat"),
        ]
        const small = await createPreset("Small box")

        await setProductPreset(shirt.id, { package_preset_id: small.id })
        const res = await setProductPreset(hat.id, {
          package_preset_id: small.id,
        })

        expect(res.status).toBe(200)
        expect(await activeLinks(shirt.id)).toHaveLength(1)
        expect(await activeLinks(hat.id)).toHaveLength(1)
      })

      it("removes the preset with null and falls back to the store default", async () => {
        const product = await createProduct()
        const storeDefault = await createPreset("Default box", {
          is_default: true,
        })
        const small = await createPreset("Small box")
        await setProductPreset(product.id, { package_preset_id: small.id })

        const res = await setProductPreset(product.id, {
          package_preset_id: null,
        })

        expect(res.status).toBe(200)
        expect(res.data.product_package_preset).toEqual({
          product_id: product.id,
          package_preset: null,
          resolved: expect.objectContaining({ id: storeDefault.id }),
        })
        expect(await activeLinks(product.id)).toHaveLength(0)
      })

      it("accepts null for a product without a preset", async () => {
        const product = await createProduct()

        const res = await setProductPreset(product.id, {
          package_preset_id: null,
        })

        expect(res.status).toBe(200)
        expect(res.data.product_package_preset.package_preset).toBeNull()
      })

      it("keeps exactly one preset when two are set concurrently", async () => {
        const product = await createProduct()
        const small = await createPreset("Small box")
        const large = await createPreset("Large box")

        await Promise.all([
          setProductPreset(product.id, { package_preset_id: small.id }),
          setProductPreset(product.id, { package_preset_id: large.id }),
        ])

        const links = await activeLinks(product.id)
        expect(links).toHaveLength(1)
        expect([small.id, large.id]).toContain(links[0].package_preset_id)
      })

      it("returns 400 when package_preset_id is missing", async () => {
        const product = await createProduct()

        const res = await setProductPreset(product.id, {})

        expect(res.status).toBe(400)
      })

      it("returns 400 when package_preset_id is only whitespace", async () => {
        const product = await createProduct()

        const res = await setProductPreset(product.id, {
          package_preset_id: "   ",
        })

        expect(res.status).toBe(400)
      })

      it("returns 400 for an unknown body field", async () => {
        const product = await createProduct()
        const small = await createPreset("Small box")

        const res = await setProductPreset(product.id, {
          package_preset_id: small.id,
          variant_id: "variant_1",
        })

        expect(res.status).toBe(400)
        expect(await activeLinks(product.id)).toHaveLength(0)
      })

      it("returns 404 for an unknown product", async () => {
        const small = await createPreset("Small box")

        const res = await setProductPreset("prod_unknown", {
          package_preset_id: small.id,
        })

        expect(res.status).toBe(404)
      })

      it("returns 404 for an unknown preset and keeps the current one", async () => {
        const product = await createProduct()
        const small = await createPreset("Small box")
        await setProductPreset(product.id, { package_preset_id: small.id })

        const res = await setProductPreset(product.id, {
          package_preset_id: "pkgpre_unknown",
        })

        expect(res.status).toBe(404)
        expect(await activeLinks(product.id)).toEqual([
          { product_id: product.id, package_preset_id: small.id },
        ])
      })

      it("returns 404 for a deleted preset", async () => {
        const product = await createProduct()
        const small = await createPreset("Small box")
        await api.delete(`/admin/package-presets/${small.id}`, adminHeaders)

        const res = await setProductPreset(product.id, {
          package_preset_id: small.id,
        })

        expect(res.status).toBe(404)
        expect(await activeLinks(product.id)).toHaveLength(0)
      })

      it("returns 401 without authentication", async () => {
        const product = await createProduct()
        const small = await createPreset("Small box")

        const res = await setProductPreset(
          product.id,
          { package_preset_id: small.id },
          { headers: {} }
        )

        expect(res.status).toBe(401)
        expect(await activeLinks(product.id)).toHaveLength(0)
      })
    })

    describe("deleting a preset", () => {
      it("unlinks its products, which fall back to the store default", async () => {
        const product = await createProduct()
        const storeDefault = await createPreset("Default box", {
          is_default: true,
        })
        const small = await createPreset("Small box")
        await setProductPreset(product.id, { package_preset_id: small.id })

        const res = await api.delete(
          `/admin/package-presets/${small.id}`,
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(await activeLinks(product.id)).toHaveLength(0)

        const getRes = await getProductPreset(product.id)
        expect(getRes.data.product_package_preset).toEqual({
          product_id: product.id,
          package_preset: null,
          resolved: expect.objectContaining({ id: storeDefault.id }),
        })
      })
    })

    describe("product-package-preset-unique-product migration script", () => {
      it("fails and names the products already linked to two presets", async () => {
        const pg = getContainer().resolve(
          ContainerRegistrationKeys.PG_CONNECTION
        )
        const product = await createProduct()
        const small = await createPreset("Small box")
        const large = await createPreset("Large box")

        // Simulate data written before the index existed.
        await pg.raw(`DROP INDEX ??`, [
          PRODUCT_PACKAGE_PRESET_UNIQUE_PRODUCT_INDEX,
        ])
        const tableName = await linkTableName()
        await pg.raw(
          `INSERT INTO ?? (id, product_id, package_preset_id) VALUES (?, ?, ?), (?, ?, ?)`,
          [
            tableName,
            "prodpkg_dup_1",
            product.id,
            small.id,
            "prodpkg_dup_2",
            product.id,
            large.id,
          ]
        )

        await expect(
          productPackagePresetUniqueProduct({ container: getContainer() })
        ).rejects.toThrow(
          `Products linked to more than one package preset: ${product.id}`
        )

        const { rows: indexes } = await pg.raw(
          `SELECT 1 FROM pg_indexes WHERE indexname = ?`,
          [PRODUCT_PACKAGE_PRESET_UNIQUE_PRODUCT_INDEX]
        )
        expect(indexes).toHaveLength(0)

        // Leave the table clean so the next beforeEach can recreate the index.
        await pg.raw(`DELETE FROM ?? WHERE product_id = ?`, [
          tableName,
          product.id,
        ])
      })

      it("rejects a second active preset for the same product", async () => {
        const pg = getContainer().resolve(
          ContainerRegistrationKeys.PG_CONNECTION
        )
        const product = await createProduct()
        const small = await createPreset("Small box")
        const large = await createPreset("Large box")
        await setProductPreset(product.id, { package_preset_id: small.id })

        await expect(
          pg.raw(
            `INSERT INTO ?? (id, product_id, package_preset_id) VALUES (?, ?, ?)`,
            [await linkTableName(), "prodpkg_dup", product.id, large.id]
          )
        ).rejects.toThrow(/duplicate key/)
      })
    })
  },
})
