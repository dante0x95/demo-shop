import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PACKAGE_PRESET_MODULE } from "../../../modules/package-preset"
import {
  DimensionUnit,
  WeightUnit,
} from "../../../modules/package-preset/utils/units"
import PackagePresetModuleService from "../../../modules/package-preset/service"
import {
  defaultPackagePresetConflictError,
  findDefaultPackagePresetId,
} from "../utils/default-package-preset-conflict"

export type CreatePackagePresetStepInput = {
  name: string
  length: number
  width: number
  height: number
  dimension_unit: DimensionUnit
  weight: number
  weight_unit: WeightUnit
  is_default?: boolean
}

export const createPackagePresetStep = createStep(
  "create-package-preset",
  async (input: CreatePackagePresetStepInput, { container }) => {
    const packagePresetModuleService: PackagePresetModuleService =
      container.resolve(PACKAGE_PRESET_MODULE)

    try {
      const packagePreset =
        await packagePresetModuleService.createPackagePresets(input)

      return new StepResponse(packagePreset, packagePreset.id)
    } catch (error) {
      if (!input.is_default) {
        throw error
      }

      // A concurrent request may have set its own default after
      // unsetDefaultPackagePresetStep ran; the unique index rejects this one.
      if (!(await findDefaultPackagePresetId(packagePresetModuleService))) {
        throw error
      }

      throw defaultPackagePresetConflictError()
    }
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const packagePresetModuleService: PackagePresetModuleService =
      container.resolve(PACKAGE_PRESET_MODULE)

    await packagePresetModuleService.deletePackagePresets(id)
  }
)
