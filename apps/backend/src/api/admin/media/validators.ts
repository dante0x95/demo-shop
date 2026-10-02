import { z } from "@medusajs/framework/zod"
import { createSelectParams } from "@medusajs/medusa/api/utils/validators"

export const AdminGetMediaAssetParams = createSelectParams()

export type AdminGetMediaAssetParamsType = z.infer<
  typeof AdminGetMediaAssetParams
>

// Multipart text fields; the files themselves are parsed by multer into
// req.files. `alt` is matched to `files` by index, so it may repeat.
export const AdminUploadMedia = z.strictObject({
  alt: z.union([z.string(), z.array(z.string())]).optional(),
})

export type AdminUploadMediaType = z.infer<typeof AdminUploadMedia>
