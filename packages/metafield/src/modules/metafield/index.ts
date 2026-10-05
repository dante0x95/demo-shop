import { Module } from "@medusajs/framework/utils"
import MetafieldModuleService from "./service"

export const METAFIELD_MODULE = "metafield"

export default Module(METAFIELD_MODULE, {
  service: MetafieldModuleService,
})
