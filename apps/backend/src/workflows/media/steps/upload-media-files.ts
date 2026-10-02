import { FileDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type UploadMediaFilesStepInput = {
  filename: string
  mimeType: string
  // Base64-encoded file content.
  content: string
  access: "public" | "private"
}[]

// Replaces core uploadFilesStep, which uploads with Promise.all: when one file
// fails, the step throws before it can record the files that did upload, so
// its compensation never deletes them. Here every upload settles first and
// the successful ones are deleted before the error is rethrown.
export const uploadMediaFilesStep = createStep(
  "upload-media-files",
  async (files: UploadMediaFilesStepInput, { container }) => {
    const fileModuleService = container.resolve(Modules.FILE)

    const results = await Promise.allSettled(
      files.map((file) => fileModuleService.createFiles(file))
    )

    const uploaded = results
      .filter(
        (result): result is PromiseFulfilledResult<FileDTO> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value)
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    )

    if (failure) {
      if (uploaded.length) {
        try {
          await fileModuleService.deleteFiles(uploaded.map((file) => file.id))
        } catch (error) {
          const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
          logger.error(
            `Failed to delete uploaded files ${uploaded.map((file) => file.id).join(", ")} after a partial upload failure: ${error}`
          )
        }
      }

      throw failure.reason
    }

    // No failure, so `uploaded` keeps the input order.
    return new StepResponse(
      uploaded,
      uploaded.map((file) => file.id)
    )
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }

    const fileModuleService = container.resolve(Modules.FILE)

    await fileModuleService.deleteFiles(ids)
  }
)
