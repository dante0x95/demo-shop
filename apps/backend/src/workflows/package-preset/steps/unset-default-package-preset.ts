import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { PACKAGE_PRESET_MODULE } from "../../../modules/package-preset"
import PackagePresetModuleService from "../../../modules/package-preset/service"
import { findDefaultPackagePresetId } from "../utils/default-package-preset-conflict"

// Clears the current default so a new preset can take its place. Returns the
// ids it cleared (at most one, enforced by the unique index on is_default).
export const unsetDefaultPackagePresetStep = createStep(
  "unset-default-package-preset",
  async (_: undefined, { container }) => {
    const packagePresetModuleService: PackagePresetModuleService =
      container.resolve(PACKAGE_PRESET_MODULE)

    const cleared = await packagePresetModuleService.updatePackagePresets({
      selector: { is_default: true },
      data: { is_default: false },
    })

    const ids = cleared.map((preset) => preset.id)

    return new StepResponse(ids, ids)
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }

    const packagePresetModuleService: PackagePresetModuleService =
      container.resolve(PACKAGE_PRESET_MODULE)

    // A concurrent request may have set its own default meanwhile; restoring
    // ours would break the one-default rule, so the newer default stays.
    if (await findDefaultPackagePresetId(packagePresetModuleService)) {
      return
    }

    await packagePresetModuleService.updatePackagePresets({
      id: ids[0],
      is_default: true,
    })
  }
)
