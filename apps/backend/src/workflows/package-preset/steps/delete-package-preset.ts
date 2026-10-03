import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PACKAGE_PRESET_MODULE } from "../../../modules/package-preset"
import PackagePresetModuleService from "../../../modules/package-preset/service"

export const deletePackagePresetStep = createStep(
  "delete-package-preset",
  async (id: string, { container }) => {
    const packagePresetModuleService: PackagePresetModuleService =
      container.resolve(PACKAGE_PRESET_MODULE)

    await packagePresetModuleService.softDeletePackagePresets(id)

    return new StepResponse(undefined, id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const packagePresetModuleService: PackagePresetModuleService =
      container.resolve(PACKAGE_PRESET_MODULE)

    await packagePresetModuleService.restorePackagePresets(id)
  }
)
