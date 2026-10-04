import { MedusaService } from "@medusajs/framework/utils"
import VariantPriceDetail from "./models/variant-price-detail"

class VariantPricingModuleService extends MedusaService({
  VariantPriceDetail,
}) {}

export default VariantPricingModuleService
