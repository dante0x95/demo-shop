import { SUPPORTED_IMAGE_MIME_TYPES } from "../../modules/media/utils/mime-types"
import { sdk } from "./sdk"

export type AdminMediaAsset = {
  id: string
  url: string
  file_id: string
  filename: string
  mime_type: string
  size: number
  alt: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type AdminMediaAssetListResponse = {
  media_assets: AdminMediaAsset[]
  count: number
  offset: number
  limit: number
}

export type AdminMediaAssetListParams = {
  limit: number
  offset: number
  order?: string
  q?: string
  mime_type?: string
}

export type AdminUploadMediaFile = {
  file: File
  alt?: string
}

// Every type the media module can store. A shop may allow fewer through the
// module's `allowed_mime_types` option; the upload API rejects the rest.
export const MEDIA_MIME_TYPES: readonly string[] = SUPPORTED_IMAGE_MIME_TYPES

export const mediaTypeLabel = (mimeType: string) =>
  (mimeType.split("/")[1] ?? mimeType).toUpperCase()

export const mediaQueryKeys = {
  all: ["media_assets"] as const,
  list: (params: AdminMediaAssetListParams) =>
    ["media_assets", "list", params] as const,
}

export const listMediaAssets = (params: AdminMediaAssetListParams) =>
  sdk.client.fetch<AdminMediaAssetListResponse>("/admin/media", {
    query: params,
  })

export const uploadMediaAssets = (files: AdminUploadMediaFile[]) => {
  const form = new FormData()

  // The API matches `alt` to `files` by index, so every file sends one
  // (an empty alt is stored as null).
  for (const { file, alt } of files) {
    form.append("files", file)
    form.append("alt", alt?.trim() ?? "")
  }

  return sdk.client.fetch<{ media_assets: AdminMediaAsset[] }>(
    "/admin/media",
    {
      method: "POST",
      // Let the browser set the multipart boundary.
      headers: { "content-type": null },
      body: form,
    }
  )
}

export const deleteMediaAsset = (id: string) =>
  sdk.client.fetch<{ id: string; object: "media_asset"; deleted: boolean }>(
    `/admin/media/${id}`,
    { method: "DELETE" }
  )
