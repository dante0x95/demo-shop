import path from "path"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { METAFIELD_MODULE } from ".."
import MetafieldDefinition from "../models/metafield-definition"
import MetafieldModuleService from "../service"

jest.setTimeout(60 * 1000)

const definition = (data: { key: string; owner_type: string }) => ({
  label: "Fabric",
  type: "text" as const,
  ...data,
})

// Runs the module's real migrations so the partial unique index on
// (owner_type, key) is the one shipped, not one derived from the models.
moduleIntegrationTestRunner<MetafieldModuleService>({
  moduleName: METAFIELD_MODULE,
  moduleModels: [MetafieldDefinition],
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
    })
  },
})
