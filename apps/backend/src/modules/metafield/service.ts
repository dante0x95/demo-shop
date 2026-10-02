import { MedusaService } from "@medusajs/framework/utils"
import MetafieldDefinition from "./models/metafield-definition"
import {
  MetafieldModuleOptions,
  ResolvedMetafieldModuleOptions,
  resolveMetafieldModuleOptions,
} from "./utils/options"

class MetafieldModuleService extends MedusaService({
  MetafieldDefinition,
}) {
  protected readonly options_: ResolvedMetafieldModuleOptions

  constructor(
    container: Record<string, unknown>,
    options?: MetafieldModuleOptions
  ) {
    super(container, options)

    this.options_ = resolveMetafieldModuleOptions(options)
  }

  async getOptions(): Promise<ResolvedMetafieldModuleOptions> {
    return this.options_
  }
}

export default MetafieldModuleService
