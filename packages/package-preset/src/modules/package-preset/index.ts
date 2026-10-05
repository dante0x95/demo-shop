import { Module } from "@medusajs/framework/utils"
import PackagePresetModuleService from "./service"

export const PACKAGE_PRESET_MODULE = "packagePreset"

export default Module(PACKAGE_PRESET_MODULE, {
  service: PackagePresetModuleService,
})
