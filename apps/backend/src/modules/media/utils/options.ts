import { MedusaError } from "@medusajs/framework/utils"
import { SUPPORTED_IMAGE_TYPES } from "./image-types"
import { SUPPORTED_IMAGE_MIME_TYPES } from "./mime-types"

export type MediaModuleOptions = {
  max_file_size?: number
  max_files?: number
  allowed_mime_types?: string[]
}

export type ResolvedMediaModuleOptions = Required<MediaModuleOptions>

export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024

export const DEFAULT_MAX_FILES = 10

export const DEFAULT_ALLOWED_MIME_TYPES: string[] = [
  ...SUPPORTED_IMAGE_MIME_TYPES,
]

const assertPositiveInteger = (name: string, value: number) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_ARGUMENT,
      `Media module option ${name} must be a positive integer, received ${value}`
    )
  }
}

// Applies defaults and fails at startup on a bad configuration, so a typo in
// the environment never silently disables a limit.
export const resolveMediaModuleOptions = (
  options: MediaModuleOptions = {}
): ResolvedMediaModuleOptions => {
  const resolved = {
    max_file_size: options.max_file_size ?? DEFAULT_MAX_FILE_SIZE,
    max_files: options.max_files ?? DEFAULT_MAX_FILES,
    allowed_mime_types: options.allowed_mime_types ?? DEFAULT_ALLOWED_MIME_TYPES,
  }

  assertPositiveInteger("max_file_size", resolved.max_file_size)
  assertPositiveInteger("max_files", resolved.max_files)

  const unsupported = resolved.allowed_mime_types.filter(
    (mimeType) => !SUPPORTED_IMAGE_TYPES[mimeType]
  )

  if (!resolved.allowed_mime_types.length || unsupported.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_ARGUMENT,
      `Media module option allowed_mime_types must be a non-empty subset of ${DEFAULT_ALLOWED_MIME_TYPES.join(", ")}` +
        (unsupported.length ? `, received ${unsupported.join(", ")}` : "")
    )
  }

  return resolved
}
