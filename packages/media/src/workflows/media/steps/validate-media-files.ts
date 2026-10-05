import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../modules/media"
import MediaModuleService from "../../../modules/media/service"
import {
  hasImageExtension,
  hasImageSignature,
  SIGNATURE_LENGTH,
} from "../../../modules/media/utils/image-types"

export type ValidateMediaFilesStepInput = {
  filename: string
  mime_type: string
  size: number
  // Base64-encoded file content.
  content: string
}[]

// Base64 encodes 3 bytes in 4 characters, so this prefix decodes to at least
// SIGNATURE_LENGTH bytes without decoding the whole file.
const SIGNATURE_BASE64_LENGTH = Math.ceil(SIGNATURE_LENGTH / 3) * 4

const invalid = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message)

// Read-only check before anything is uploaded, so nothing needs compensating.
export const validateMediaFilesStep = createStep(
  "validate-media-files",
  async (files: ValidateMediaFilesStepInput, { container }) => {
    const mediaModuleService: MediaModuleService =
      container.resolve(MEDIA_MODULE)
    const { max_file_size, max_files, allowed_mime_types } =
      await mediaModuleService.getOptions()

    if (!files.length) {
      throw invalid("No files were uploaded")
    }

    if (files.length > max_files) {
      throw invalid(`Too many files: the maximum is ${max_files} per request`)
    }

    for (const file of files) {
      if (!allowed_mime_types.includes(file.mime_type)) {
        throw invalid(
          `File ${file.filename} has an unsupported type ${file.mime_type}. Allowed types: ${allowed_mime_types.join(", ")}`
        )
      }

      if (file.size > max_file_size) {
        throw invalid(
          `File ${file.filename} exceeds the maximum size of ${max_file_size} bytes`
        )
      }

      // Some file providers serve files by extension, so it must agree with
      // the declared type.
      if (!hasImageExtension(file.mime_type, file.filename)) {
        throw invalid(
          `File ${file.filename} has an extension that does not match its type ${file.mime_type}`
        )
      }

      const header = Buffer.from(
        file.content.slice(0, SIGNATURE_BASE64_LENGTH),
        "base64"
      )

      if (!hasImageSignature(file.mime_type, header)) {
        throw invalid(
          `File ${file.filename} content is not a valid ${file.mime_type} image`
        )
      }
    }

    return new StepResponse(undefined)
  }
)
