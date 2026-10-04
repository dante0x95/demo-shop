import { Module } from "@medusajs/framework/utils"
import VariantPricingModuleService from "./service"

export const VARIANT_PRICING_MODULE = "variantPricing"

export default Module(VARIANT_PRICING_MODULE, {
  service: VariantPricingModuleService,
})
