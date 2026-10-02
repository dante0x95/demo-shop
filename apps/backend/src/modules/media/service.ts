import { MedusaService } from "@medusajs/framework/utils"
import MediaAsset from "./models/media-asset"

export type MediaModuleOptions = {
  max_file_size?: number
  allowed_mime_types?: string[]
}

export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024

export const DEFAULT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]

class MediaModuleService extends MedusaService({
  MediaAsset,
}) {
  protected readonly options_: Required<MediaModuleOptions>

  constructor(container: Record<string, unknown>, options: MediaModuleOptions = {}) {
    super(container, options)

    this.options_ = {
      max_file_size: options.max_file_size ?? DEFAULT_MAX_FILE_SIZE,
      allowed_mime_types: options.allowed_mime_types ?? DEFAULT_ALLOWED_MIME_TYPES,
    }
  }

  async getOptions(): Promise<Required<MediaModuleOptions>> {
    return this.options_
  }
}

export default MediaModuleService
