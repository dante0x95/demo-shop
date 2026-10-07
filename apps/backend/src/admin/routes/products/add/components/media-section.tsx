import { Photo, Trash } from "@medusajs/icons"
import { Badge, Button, IconButton, Text } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import {
  AdminMediaAsset,
  mediaQueryKeys,
  uploadMediaAssets,
  useAllowedMediaTypes,
} from "../../../../lib/media"
import { effectiveThumbnailId } from "../utils"
import { Section } from "./field"
import { MediaPickerModal } from "./media-picker-modal"

type MediaSectionProps = {
  mediaIds: string[]
  thumbnailId: string | null
  // Every asset the page has seen, by id, to show the picked ones.
  assets: Record<string, AdminMediaAsset>
  disabled: boolean
  onAdd: (assets: AdminMediaAsset[]) => void
  onRemove: (id: string) => void
  onSetThumbnail: (id: string) => void
  // Tells the page while files are uploading, so it can hold the save until
  // they are part of the product.
  onUploadingChange: (uploading: boolean) => void
}

// The product's media: picked from the library or uploaded to it (uploads
// land in the library too, like on the Media page).
export const MediaSection = ({
  mediaIds,
  thumbnailId,
  assets,
  disabled,
  onAdd,
  onRemove,
  onSetThumbnail,
  onUploadingChange,
}: MediaSectionProps) => {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const allowedTypes = useAllowedMediaTypes()
  const queryClient = useQueryClient()
  const thumbnail = effectiveThumbnailId({
    media_ids: mediaIds,
    thumbnail_id: thumbnailId,
  })

  const { mutate: upload, isPending: isUploading } = useMutation({
    mutationFn: (files: File[]) =>
      uploadMediaAssets(files.map((file) => ({ file }))),
    onSuccess: ({ media_assets }) => {
      queryClient.invalidateQueries({ queryKey: mediaQueryKeys.all })
      setUploadError(null)
      onAdd(media_assets)
    },
    onError: (err: Error) => {
      setUploadError(err.message || "Failed to upload media")
    },
  })

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    // Allow picking the same file again.
    e.target.value = ""

    if (files.length) {
      upload(files)
    }
  }

  useEffect(() => {
    onUploadingChange(isUploading)
  }, [isUploading])

  const busy = disabled || isUploading

  return (
    <Section
      title="Media"
      testId="add-product-media"
      actions={
        <div className="flex items-center gap-x-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            aria-label="Upload media files"
            // No filter until the config loads; the API checks anyway.
            accept={allowedTypes.join(",") || undefined}
            className="hidden"
            onChange={handleFiles}
            disabled={busy}
          />
          <Button
            size="small"
            variant="secondary"
            type="button"
            onClick={() => inputRef.current?.click()}
            isLoading={isUploading}
            disabled={busy}
          >
            Upload
          </Button>
          <Button
            size="small"
            variant="secondary"
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={busy}
          >
            Choose from library
          </Button>
        </div>
      }
    >
      {uploadError && (
        <Text
          role="alert"
          size="small"
          leading="compact"
          className="text-ui-fg-error"
        >
          {uploadError}
        </Text>
      )}
      {mediaIds.length ? (
        <ul
          aria-label="Product media"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {mediaIds.map((id) => {
            const asset = assets[id]
            const name = asset?.filename ?? id
            const isThumbnail = id === thumbnail

            return (
              <li
                key={id}
                aria-label={name}
                className="bg-ui-bg-component shadow-elevation-card-rest flex flex-col gap-y-2 rounded-md p-2"
              >
                <div className="bg-ui-bg-subtle flex aspect-square items-center justify-center overflow-hidden rounded">
                  {asset?.url ? (
                    <img
                      src={asset.url}
                      alt={asset.alt ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Photo className="text-ui-fg-subtle" />
                  )}
                </div>
                <Text size="xsmall" leading="compact" className="truncate">
                  {name}
                </Text>
                <div className="flex items-center justify-between gap-x-1">
                  {isThumbnail ? (
                    <Badge size="2xsmall" color="blue">
                      Thumbnail
                    </Badge>
                  ) : (
                    <Button
                      size="small"
                      variant="transparent"
                      type="button"
                      onClick={() => onSetThumbnail(id)}
                      disabled={busy}
                      aria-label={`Use ${name} as thumbnail`}
                    >
                      Use as thumbnail
                    </Button>
                  )}
                  <IconButton
                    size="small"
                    variant="transparent"
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => onRemove(id)}
                    disabled={busy}
                  >
                    <Trash />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          No media yet. Upload images or choose them from the media library. The
          first one is the thumbnail unless you pick another.
        </Text>
      )}
      <MediaPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={onAdd}
      />
    </Section>
  )
}
