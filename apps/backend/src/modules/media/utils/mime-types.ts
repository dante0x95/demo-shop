// The image MIME types the media module can verify. Plain data with no Node
// APIs, so the admin UI can import it too; `image-types.ts` must define a
// signature for each of them.
export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
] as const

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number]
