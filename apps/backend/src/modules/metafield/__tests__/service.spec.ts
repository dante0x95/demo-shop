import path from "path"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { METAFIELD_MODULE } from ".."
import MetafieldDefinition from "../models/metafield-definition"
import MetafieldValue from "../models/metafield-value"
import MetafieldModuleService from "../service"

jest.setTimeout(60 * 1000)

const definition = (data: { key: string; owner_type: string }) => ({
  label: "Fabric",
  type: "text" as const,
  ...data,
})

const value = (data: {
  key: string
  owner_id: string
  owner_type?: string
  type?: "text" | "number"
}) => ({
  owner_type: "product",
  type: "text" as const,
  value: "x",
  ...data,
})

// Runs the module's real migrations so the partial unique index on
// (owner_type, key) is the one shipped, not one derived from the models.
moduleIntegrationTestRunner<MetafieldModuleService>({
  moduleName: METAFIELD_MODULE,
  moduleModels: [MetafieldDefinition, MetafieldValue],
  resolve: path.join(__dirname, ".."),
  pathToMigrations: path.join(__dirname, "../migrations"),
  moduleOptions: { owner_types: ["product", "product_variant"] },
  testSuite: ({ service }) => {
    describe("MetafieldModuleService", () => {
      it("exposes the resolved module options", async () => {
        expect(await service.getOptions()).toEqual({
          owner_types: ["product", "product_variant"],
        })
      })

      it("allows the same key under different owner types", async () => {
        const created = await service.createMetafieldDefinitions([
          definition({ key: "fabric", owner_type: "product" }),
          definition({ key: "fabric", owner_type: "product_variant" }),
        ])

        expect(created).toHaveLength(2)
      })

      it("rejects the same key twice under one owner type", async () => {
        await service.createMetafieldDefinitions(
          definition({ key: "fabric", owner_type: "product" })
        )

        await expect(
          service.createMetafieldDefinitions(
            definition({ key: "fabric", owner_type: "product" })
          )
        ).rejects.toThrow()
      })

      it("allows reusing the key of a soft-deleted definition", async () => {
        const removed = await service.createMetafieldDefinitions(
          definition({ key: "fabric", owner_type: "product" })
        )

        await service.softDeleteMetafieldDefinitions(removed.id)

        const created = await service.createMetafieldDefinitions(
          definition({ key: "fabric", owner_type: "product" })
        )

        expect(created.id).not.toBe(removed.id)
      })

      it("creates definitions with storefront access off by default", async () => {
        const created = await service.createMetafieldDefinitions(
          definition({ key: "fabric", owner_type: "product" })
        )

        expect(created.storefront_access).toBe(false)
      })

      it("rejects a second value for the same owner and key", async () => {
        await service.createMetafieldValues(
          value({ key: "fabric", owner_id: "prod_1" })
        )

        await expect(
          service.createMetafieldValues(
            value({ key: "fabric", owner_id: "prod_1" })
          )
        ).rejects.toThrow()
      })

      it("allows a new value once the previous one was soft-deleted", async () => {
        const removed = await service.createMetafieldValues(
          value({ key: "fabric", owner_id: "prod_1" })
        )

        await service.softDeleteMetafieldValues(removed.id)

        const created = await service.createMetafieldValues(
          value({ key: "fabric", owner_id: "prod_1" })
        )

        expect(created.id).not.toBe(removed.id)
      })

      describe("listAndCountUnstructuredMetafieldKeys", () => {
        it("lists keys with values but no definition, with counts, by key", async () => {
          await service.createMetafieldDefinitions(
            definition({ key: "fabric", owner_type: "product" })
          )
          await service.createMetafieldValues([
            value({ key: "fabric", owner_id: "prod_1" }),
            value({ key: "legacy", owner_id: "prod_1" }),
            value({ key: "legacy", owner_id: "prod_2" }),
            value({ key: "count", owner_id: "prod_1", type: "number" }),
            value({
              key: "other_owner",
              owner_id: "variant_1",
              owner_type: "product_variant",
            }),
          ])

          const [keys, count] =
            await service.listAndCountUnstructuredMetafieldKeys("product")

          expect(count).toBe(2)
          expect(keys).toEqual([
            { key: "count", type: "number", values_count: 1 },
            { key: "legacy", type: "text", values_count: 2 },
          ])
        })

        it("treats keys of a deleted definition as unstructured", async () => {
          const removed = await service.createMetafieldDefinitions(
            definition({ key: "fabric", owner_type: "product" })
          )
          await service.createMetafieldValues(
            value({ key: "fabric", owner_id: "prod_1" })
          )

          await service.softDeleteMetafieldDefinitions(removed.id)

          const [keys] =
            await service.listAndCountUnstructuredMetafieldKeys("product")

          expect(keys).toEqual([
            { key: "fabric", type: "text", values_count: 1 },
          ])
        })

        it("leaves out soft-deleted values", async () => {
          const removed = await service.createMetafieldValues(
            value({ key: "legacy", owner_id: "prod_1" })
          )

          await service.softDeleteMetafieldValues(removed.id)

          expect(
            await service.listAndCountUnstructuredMetafieldKeys("product")
          ).toEqual([[], 0])
        })

        it("paginates the keys and counts all of them", async () => {
          await service.createMetafieldValues(
            ["a_key", "b_key", "c_key"].map((key) =>
              value({ key, owner_id: "prod_1" })
            )
          )

          const [keys, count] =
            await service.listAndCountUnstructuredMetafieldKeys("product", {
              skip: 1,
              take: 1,
            })

          expect(count).toBe(3)
          expect(keys.map((k) => k.key)).toEqual(["b_key"])
        })
      })
    })
  },
})
