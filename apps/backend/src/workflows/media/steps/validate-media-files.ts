import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../modules/media"
import MediaModuleService from "../../../modules/media/service"

export type ValidateMediaFilesStepInput = {
  filename: string
  mime_type: string
  size: number
}[]

// Read-only check before anything is uploaded, so nothing needs compensating.
export const validateMediaFilesStep = createStep(
  "validate-media-files",
  async (files: ValidateMediaFilesStepInput, { container }) => {
    const mediaModuleService: MediaModuleService =
      container.resolve(MEDIA_MODULE)
    const { max_file_size, allowed_mime_types } =
      await mediaModuleService.getOptions()

    if (!files.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No files were uploaded"
      )
    }

    for (const file of files) {
      if (!allowed_mime_types.includes(file.mime_type)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `File ${file.filename} has an unsupported type ${file.mime_type}. Allowed types: ${allowed_mime_types.join(", ")}`
        )
      }

      if (file.size > max_file_size) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `File ${file.filename} exceeds the maximum size of ${max_file_size} bytes`
        )
      }
    }

    return new StepResponse(undefined)
  }
)
