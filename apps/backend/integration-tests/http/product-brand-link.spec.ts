import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import ProductBrandLink from "@dante0x95/medusa-plugin-brand/links/product-brand"
import productBrandUniqueProduct, {
  PRODUCT_BRAND_UNIQUE_PRODUCT_INDEX,
} from "@dante0x95/medusa-plugin-brand/migration-scripts/product-brand-unique-product"
import { BRAND_MODULE } from "@dante0x95/medusa-plugin-brand/modules/brand"
import { createAdminUser } from "../helpers/admin-auth"

jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    const createBrand = async (name: string) => {
      const res = await api.post("/admin/brands", { name }, adminHeaders)
      return res.data.brand
    }

    const createProduct = async () => {
      const {
        result: [product],
      } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: "Shirt",
              options: [{ title: "Size", values: ["M"] }],
              variants: [{ title: "M", options: { Size: "M" }, prices: [] }],
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

    const activeLinks = async (productId: string) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: ProductBrandLink.entryPoint,
        fields: ["product_id", "brand_id"],
        filters: { product_id: productId },
      })
      return data
    }

    // The test runner syncs links but does not run migration scripts.
    beforeEach(async () => {
      await productBrandUniqueProduct({ container: getContainer() })
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("product-brand link", () => {
      it("keeps one brand per product when two links are created concurrently", async () => {
        const [nike, adidas] = [
          await createBrand("Nike"),
          await createBrand("Adidas"),
        ]
        const product = await createProduct()

        const results = await Promise.allSettled([
          linkProduct(product.id, nike.id),
          linkProduct(product.id, adidas.id),
        ])

        expect(results.map((r) => r.status).sort()).toEqual([
          "fulfilled",
          "rejected",
        ])
        expect(await activeLinks(product.id)).toHaveLength(1)
      })

      it("rejects a second brand for an already linked product", async () => {
        const [nike, adidas] = [
          await createBrand("Nike"),
          await createBrand("Adidas"),
        ]
        const product = await createProduct()
        await linkProduct(product.id, nike.id)

        await expect(linkProduct(product.id, adidas.id)).rejects.toThrow()

        expect(await activeLinks(product.id)).toEqual([
          expect.objectContaining({ brand_id: nike.id }),
        ])
      })

      it("allows a new brand once the previous brand is deleted", async () => {
        const [nike, adidas] = [
          await createBrand("Nike"),
          await createBrand("Adidas"),
        ]
        const product = await createProduct()
        await linkProduct(product.id, nike.id)

        await api.delete(`/admin/brands/${nike.id}`, adminHeaders)
        await linkProduct(product.id, adidas.id)

        expect(await activeLinks(product.id)).toEqual([
          expect.objectContaining({ brand_id: adidas.id }),
        ])
      })
    })

    describe("product-brand-unique-product migration script", () => {
      it("fails and names the products already linked to two brands", async () => {
        const pg = getContainer().resolve(
          ContainerRegistrationKeys.PG_CONNECTION
        )
        const [nike, adidas] = [
          await createBrand("Nike"),
          await createBrand("Adidas"),
        ]
        const product = await createProduct()

        // Simulate data written before the index existed.
        await pg.raw(`DROP INDEX ??`, [PRODUCT_BRAND_UNIQUE_PRODUCT_INDEX])
        const {
          rows: [{ table_name: tableName }],
        } = await pg.raw(
          `SELECT table_name FROM link_module_migrations
           WHERE link_descriptor->>'fromModule' = 'product'
             AND link_descriptor->>'toModule' = 'brand'`
        )
        await pg.raw(
          `INSERT INTO ?? (id, product_id, brand_id) VALUES (?, ?, ?), (?, ?, ?)`,
          [
            tableName,
            "prodbrand_dup_1",
            product.id,
            nike.id,
            "prodbrand_dup_2",
            product.id,
            adidas.id,
          ]
        )

        await expect(
          productBrandUniqueProduct({ container: getContainer() })
        ).rejects.toThrow(
          `Products linked to more than one brand: ${product.id}`
        )

        const { rows: indexes } = await pg.raw(
          `SELECT 1 FROM pg_indexes WHERE indexname = ?`,
          [PRODUCT_BRAND_UNIQUE_PRODUCT_INDEX]
        )
        expect(indexes).toHaveLength(0)

        // Leave the table clean so the next beforeEach can recreate the index.
        await pg.raw(`DELETE FROM ?? WHERE product_id = ?`, [
          tableName,
          product.id,
        ])
      })
    })
  },
})
