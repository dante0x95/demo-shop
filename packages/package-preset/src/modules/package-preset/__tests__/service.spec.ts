import path from "path"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { PACKAGE_PRESET_MODULE } from ".."
import PackagePreset from "../models/package-preset"
import PackagePresetModuleService from "../service"

jest.setTimeout(60 * 1000)

const preset = (data: { name: string; is_default?: boolean }) => ({
  length: 30,
  width: 20,
  height: 10.5,
  dimension_unit: "cm" as const,
  weight: 0.25,
  weight_unit: "kg" as const,
  ...data,
})

// Runs the module's real migrations so the partial unique index on
// is_default is the one shipped, not one derived from the models.
moduleIntegrationTestRunner<PackagePresetModuleService>({
  moduleName: PACKAGE_PRESET_MODULE,
  moduleModels: [PackagePreset],
  resolve: path.join(__dirname, ".."),
  pathToMigrations: path.join(__dirname, "../migrations"),
  testSuite: ({ service }) => {
    describe("PackagePresetModuleService", () => {
      it("stores dimensions and weight as numbers", async () => {
        const created = await service.createPackagePresets(
          preset({ name: "Small box" })
        )

        const retrieved = await service.retrievePackagePreset(created.id)

        expect(retrieved).toEqual(
          expect.objectContaining({
            name: "Small box",
            length: 30,
            width: 20,
            height: 10.5,
            dimension_unit: "cm",
            weight: 0.25,
            weight_unit: "kg",
            is_default: false,
          })
        )
      })

      it("allows many presets that are not the default", async () => {
        const created = await service.createPackagePresets([
          preset({ name: "Small box" }),
          preset({ name: "Large box", is_default: false }),
        ])

        expect(created).toHaveLength(2)
      })

      it("rejects a second default", async () => {
        await service.createPackagePresets(
          preset({ name: "Small box", is_default: true })
        )

        await expect(
          service.createPackagePresets(
            preset({ name: "Large box", is_default: true })
          )
        ).rejects.toThrow()
      })

      it("allows a new default once the previous one is soft-deleted", async () => {
        const removed = await service.createPackagePresets(
          preset({ name: "Small box", is_default: true })
        )

        await service.softDeletePackagePresets(removed.id)

        const created = await service.createPackagePresets(
          preset({ name: "Large box", is_default: true })
        )

        expect(created.is_default).toBe(true)
      })
    })
  },
})
