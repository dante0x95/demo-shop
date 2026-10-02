import { Module } from "@medusajs/framework/utils"
import DriverModuleService from "./service"

export const DRIVER_MODULE = "driver"

export default Module(DRIVER_MODULE, {
  service: DriverModuleService,
})
