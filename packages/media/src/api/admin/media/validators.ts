import { z } from "@medusajs/framework/zod"
import {
  createFindParams,
  createSelectParams,
} from "@medusajs/medusa/api/utils/validators"

export const AdminGetMediaAssetParams = createSelectParams()

export type AdminGetMediaAssetParamsType = z.infer<
  typeof AdminGetMediaAssetParams
>

// `with_deleted` is left out: a deleted asset's file is gone, so it has no
// place in the library.
export const AdminGetMediaAssetsParams = z.strictObject({
  ...createFindParams({ limit: 20, offset: 0, order: "-created_at" }).omit({
    with_deleted: true,
  }).shape,
  q: z.string().trim().min(1).optional(),
  mime_type: z
    .union([
      z.string().trim().min(1),
      z.array(z.string().trim().min(1)).min(1),
    ])
    .optional(),
})

export type AdminGetMediaAssetsParamsType = z.infer<
  typeof AdminGetMediaAssetsParams
>

// Multipart text fields; the files themselves are parsed by multer into
// req.files. `alt` is matched to `files` by index, so it may repeat.
export const AdminUploadMedia = z.strictObject({
  alt: z.union([z.string(), z.array(z.string())]).optional(),
})

export type AdminUploadMediaType = z.infer<typeof AdminUploadMedia>
