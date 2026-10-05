import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PACKAGE_PRESET_MODULE } from "../../../modules/package-preset"
import PackagePresetModuleService from "../../../modules/package-preset/service"
import {
  defaultPackagePresetConflictError,
  findDefaultPackagePresetId,
} from "../utils/default-package-preset-conflict"

// Marks an existing preset as the default. Runs after
// unsetDefaultPackagePresetStep has cleared the previous default.
export const setDefaultPackagePresetStep = createStep(
  "set-default-package-preset",
  async (id: string, { container }) => {
    const packagePresetModuleService: PackagePresetModuleService =
      container.resolve(PACKAGE_PRESET_MODULE)

    try {
      await packagePresetModuleService.updatePackagePresets({
        id,
        is_default: true,
      })
    } catch (error) {
      // A concurrent request may have set its own default after
      // unsetDefaultPackagePresetStep ran; the unique index rejects this one.
      const currentId = await findDefaultPackagePresetId(
        packagePresetModuleService
      )

      if (!currentId || currentId === id) {
        throw error
      }

      throw defaultPackagePresetConflictError()
    }

    return new StepResponse(undefined, id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const packagePresetModuleService: PackagePresetModuleService =
      container.resolve(PACKAGE_PRESET_MODULE)

    await packagePresetModuleService.updatePackagePresets({
      id,
      is_default: false,
    })
  }
)
