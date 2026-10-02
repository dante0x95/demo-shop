import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createMediaAssetsStep } from "./steps/create-media-assets"
import { uploadMediaFilesStep } from "./steps/upload-media-files"
import { validateMediaFilesStep } from "./steps/validate-media-files"

export type UploadMediaWorkflowInput = {
  files: {
    filename: string
    mime_type: string
    size: number
    // Base64-encoded file content.
    content: string
    alt?: string | null
  }[]
}

export const uploadMediaWorkflow = createWorkflow(
  "upload-media",
  function (input: UploadMediaWorkflowInput) {
    const filesToValidate = transform({ input }, ({ input }) =>
      input.files.map(({ filename, mime_type, size, content }) => ({
        filename,
        mime_type,
        size,
        content,
      }))
    )

    validateMediaFilesStep(filesToValidate)

    const filesToUpload = transform({ input }, ({ input }) =>
      input.files.map((file) => ({
        filename: file.filename,
        mimeType: file.mime_type,
        content: file.content,
        access: "public" as const,
      }))
    )

    // Deletes the uploaded files when a later step fails, and cleans up
    // after itself when only some of the uploads succeed.
    const uploadedFiles = uploadMediaFilesStep(filesToUpload)

    // Uploaded files keep the input order, so they zip by index.
    const mediaAssetsData = transform(
      { input, uploadedFiles },
      ({ input, uploadedFiles }) =>
        uploadedFiles.map((uploadedFile, index) => ({
          url: uploadedFile.url,
          file_id: uploadedFile.id,
          filename: input.files[index].filename,
          mime_type: input.files[index].mime_type,
          size: input.files[index].size,
          alt: input.files[index].alt ?? null,
        }))
    )

    const mediaAssets = createMediaAssetsStep(mediaAssetsData)

    return new WorkflowResponse(mediaAssets)
  }
)
