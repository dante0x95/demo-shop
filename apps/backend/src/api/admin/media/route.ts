import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { uploadMediaWorkflow } from "../../../workflows/media/upload-media"
import { AdminUploadMediaType } from "./validators"

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUploadMediaType>,
  res: MedusaResponse
) => {
  const files = (req.files ?? []) as Express.Multer.File[]
  const alts = [req.validatedBody.alt ?? []].flat()

  // `alt` is matched to files by index, so an extra value has no file.
  if (alts.length > files.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Received ${alts.length} alt values for ${files.length} files`
    )
  }

  const { result } = await uploadMediaWorkflow(req.scope).run({
    input: {
      files: files.map((file, index) => ({
        filename: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        content: file.buffer.toString("base64"),
        alt: alts[index]?.trim() || null,
      })),
    },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const ids = result.map((mediaAsset) => mediaAsset.id)

  const { data } = await query.graph({
    entity: "media_asset",
    // `id` is always selected because the response is ordered by it.
    fields: [...new Set([...req.queryConfig.fields, "id"])],
    filters: { id: ids },
  })

  // Keep the order of the uploaded files so callers can match them by index.
  const media_assets = ids.map((id) => data.find((asset) => asset.id === id))

  res.json({ media_assets })
}
