// The image MIME types the media module can verify; `image-types.ts` must
// define a signature for each of them. The admin reads the shop's allowed
// subset from GET /admin/media/config instead of this list.
export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
] as const

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number]
