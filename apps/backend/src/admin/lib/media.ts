import { useQuery } from "@tanstack/react-query"
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

// The media module's options as the shop configured them.
export type AdminMediaConfig = {
  allowed_mime_types: string[]
  max_file_size: number
  max_files: number
}

export const mediaTypeLabel = (mimeType: string) =>
  (mimeType.split("/")[1] ?? mimeType).toUpperCase()

export const mediaQueryKeys = {
  all: ["media_assets"] as const,
  list: (params: AdminMediaAssetListParams) =>
    ["media_assets", "list", params] as const,
  // Outside `all`, so uploads and deletes don't refetch it.
  config: ["media_config"] as const,
}

export const getMediaConfig = () =>
  sdk.client.fetch<{ config: AdminMediaConfig }>("/admin/media/config")

// Only the types the shop allows (the upload API rejects the rest). Empty
// until the config loads.
export const useAllowedMediaTypes = (): string[] => {
  const { data } = useQuery({
    queryKey: mediaQueryKeys.config,
    queryFn: getMediaConfig,
  })

  return data?.config.allowed_mime_types ?? []
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
