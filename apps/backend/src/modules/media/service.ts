import { MedusaService } from "@medusajs/framework/utils"
import MediaAsset from "./models/media-asset"
import {
  MediaModuleOptions,
  ResolvedMediaModuleOptions,
  resolveMediaModuleOptions,
} from "./utils/options"

class MediaModuleService extends MedusaService({
  MediaAsset,
}) {
  protected readonly options_: ResolvedMediaModuleOptions

  constructor(container: Record<string, unknown>, options?: MediaModuleOptions) {
    super(container, options)

    this.options_ = resolveMediaModuleOptions(options)
  }

  async getOptions(): Promise<ResolvedMediaModuleOptions> {
    return this.options_
  }
}

export default MediaModuleService
