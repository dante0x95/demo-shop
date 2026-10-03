import { MedusaError } from "@medusajs/framework/utils"
import PackagePresetModuleService from "../../../modules/package-preset/service"

// The id of the current non-deleted default, if any (at most one, enforced by
// the unique index on is_default).
export const findDefaultPackagePresetId = async (
  packagePresetModuleService: PackagePresetModuleService
): Promise<string | undefined> => {
  const [current] = await packagePresetModuleService.listPackagePresets(
    { is_default: true },
    { select: ["id"], take: 1 }
  )

  return current?.id
}

// A concurrent request set its own default first; the unique index rejected
// this one.
export const defaultPackagePresetConflictError = () =>
  new MedusaError(
    MedusaError.Types.CONFLICT,
    "Another package preset was set as the default at the same time. Retry the request."
  )
