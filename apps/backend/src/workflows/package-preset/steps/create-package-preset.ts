import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PACKAGE_PRESET_MODULE } from "../../../modules/package-preset"
import {
  DimensionUnit,
  WeightUnit,
} from "../../../modules/package-preset/models/package-preset"
import PackagePresetModuleService from "../../../modules/package-preset/service"

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
      const [current] = await packagePresetModuleService.listPackagePresets(
        { is_default: true },
        { select: ["id"], take: 1 }
      )

      if (!current) {
        throw error
      }

      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "Another package preset was set as the default at the same time. Retry the request."
      )
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
