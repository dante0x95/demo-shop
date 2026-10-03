import { MedusaService } from "@medusajs/framework/utils"
import PackagePreset from "./models/package-preset"

class PackagePresetModuleService extends MedusaService({
  PackagePreset,
}) {}

export default PackagePresetModuleService
