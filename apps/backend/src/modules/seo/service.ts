import { MedusaService } from "@medusajs/framework/utils"
import ProductSeoOverride from "./models/product-seo-override"

class SeoModuleService extends MedusaService({
  ProductSeoOverride,
}) {}

export default SeoModuleService
