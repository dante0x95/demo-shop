import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  deleteFilesStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { deleteMediaAssetStep } from "./steps/delete-media-asset"
import { validateMediaAssetNotInUseStep } from "./steps/validate-media-asset-not-in-use"

export type DeleteMediaWorkflowInput = {
  id: string
}

export const deleteMediaWorkflow = createWorkflow(
  "delete-media",
  function (input: DeleteMediaWorkflowInput) {
    // Unknown or already deleted id -> 404.
    const { data: mediaAssets } = useQueryGraphStep({
      entity: "media_asset",
      fields: ["id", "url", "file_id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    })

    const mediaAsset = transform({ mediaAssets }, ({ mediaAssets }) => ({
      id: mediaAssets[0].id as string,
      url: mediaAssets[0].url as string,
      file_id: mediaAssets[0].file_id as string,
    }))

    validateMediaAssetNotInUseStep({ id: mediaAsset.id, url: mediaAsset.url })

    deleteMediaAssetStep(input.id)

    // Last, because a deleted file can't be restored: if this fails, the
    // record is restored and nothing points to a missing file.
    deleteFilesStep(
      transform({ mediaAsset }, ({ mediaAsset }) => [mediaAsset.file_id])
    )

    return new WorkflowResponse(input.id)
  }
)
