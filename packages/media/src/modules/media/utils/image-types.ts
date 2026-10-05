import { SupportedImageMimeType } from "./mime-types"

type ImageType = {
  extensions: string[]
  matchesSignature: (bytes: Buffer) => boolean
}

const startsWith = (bytes: Buffer, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte)

const asciiAt = (bytes: Buffer, offset: number, text: string) =>
  bytes.subarray(offset, offset + text.length).toString("latin1") === text

// One entry per SUPPORTED_IMAGE_MIME_TYPES item (the type enforces it). The
// signature is the fixed header every file of that type starts with; it is a
// cheap guard against mislabeled or non-image content, not a full decode.
const IMAGE_TYPES: Record<SupportedImageMimeType, ImageType> = {
  "image/jpeg": {
    extensions: [".jpg", ".jpeg"],
    matchesSignature: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  },
  "image/png": {
    extensions: [".png"],
    matchesSignature: (bytes) =>
      startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  "image/gif": {
    extensions: [".gif"],
    matchesSignature: (bytes) =>
      asciiAt(bytes, 0, "GIF87a") || asciiAt(bytes, 0, "GIF89a"),
  },
  "image/webp": {
    extensions: [".webp"],
    matchesSignature: (bytes) =>
      asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP"),
  },
  "image/avif": {
    extensions: [".avif"],
    matchesSignature: (bytes) =>
      asciiAt(bytes, 4, "ftyp") &&
      (asciiAt(bytes, 8, "avif") || asciiAt(bytes, 8, "avis")),
  },
}

// Looked up by any string (a request's MIME type), so unknown keys are allowed.
export const SUPPORTED_IMAGE_TYPES: Record<string, ImageType> = IMAGE_TYPES

// Bytes needed to check every signature above.
export const SIGNATURE_LENGTH = 12

export const hasImageExtension = (mimeType: string, filename: string) => {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase()

  return (
    filename.includes(".") &&
    (SUPPORTED_IMAGE_TYPES[mimeType]?.extensions.includes(extension) ?? false)
  )
}

export const hasImageSignature = (mimeType: string, bytes: Buffer) =>
  SUPPORTED_IMAGE_TYPES[mimeType]?.matchesSignature(bytes) ?? false
