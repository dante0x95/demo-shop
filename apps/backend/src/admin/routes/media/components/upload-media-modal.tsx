import { Trash } from "@medusajs/icons"
import {
  Button,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChangeEvent, FormEvent, useRef, useState } from "react"
import {
  AdminUploadMediaFile,
  mediaQueryKeys,
  uploadMediaAssets,
  useAllowedMediaTypes,
} from "../../../lib/media"
import { formatFileSize } from "../utils"

type SelectedFile = AdminUploadMediaFile & { key: string }

let nextKey = 0

export const UploadMediaModal = () => {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const allowedTypes = useAllowedMediaTypes()
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: uploadMediaAssets,
    onSuccess: ({ media_assets }) => {
      queryClient.invalidateQueries({ queryKey: mediaQueryKeys.all })
      toast.success(
        media_assets.length === 1
          ? `"${media_assets[0].filename}" uploaded`
          : `${media_assets.length} files uploaded`
      )
      handleOpenChange(false)
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to upload media")
    },
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)

    if (!next) {
      setFiles([])
      setError(null)
    }
  }

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).map((file) => ({
      key: `${nextKey++}`,
      file,
      alt: "",
    }))

    setFiles((prev) => [...prev, ...picked])
    setError(null)
    // Allow picking the same file again after removing it.
    e.target.value = ""
  }

  const setAlt = (key: string, alt: string) => {
    setFiles((prev) =>
      prev.map((item) => (item.key === key ? { ...item, alt } : item))
    )
  }

  const removeFile = (key: string) => {
    setFiles((prev) => prev.filter((item) => item.key !== key))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!files.length) {
      setError("Select at least one file to upload")
      return
    }

    mutate(files.map(({ file, alt }) => ({ file, alt })))
  }

  return (
    <FocusModal open={open} onOpenChange={handleOpenChange}>
      <FocusModal.Trigger asChild>
        <Button size="small" variant="secondary">
          Upload
        </Button>
      </FocusModal.Trigger>
      <FocusModal.Content>
        <form
          onSubmit={handleSubmit}
          className="flex h-full flex-col overflow-hidden"
        >
          <FocusModal.Header>
            <div className="flex items-center justify-end gap-x-2">
              <FocusModal.Close asChild>
                <Button
                  size="small"
                  variant="secondary"
                  type="button"
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </FocusModal.Close>
              <Button size="small" type="submit" isLoading={isPending}>
                Upload
              </Button>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-1 flex-col items-center overflow-y-auto py-16">
            <div className="flex w-full max-w-[720px] flex-col gap-y-8">
              <div className="flex flex-col gap-y-1">
                <Heading>Upload media</Heading>
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-subtle"
                >
                  Images only. Alt text describes the image for screen readers
                  and search engines.
                </Text>
              </div>
              {error && (
                <div className="bg-ui-bg-subtle shadow-borders-base rounded-md px-4 py-3">
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-error"
                  >
                    {error}
                  </Text>
                </div>
              )}
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="media-files" size="small" weight="plus">
                  Files
                </Label>
                <input
                  ref={inputRef}
                  id="media-files"
                  type="file"
                  multiple
                  // No filter until the config loads; the API checks anyway.
                  accept={allowedTypes.join(",") || undefined}
                  className="hidden"
                  onChange={handleFilesChange}
                  disabled={isPending}
                />
                <div>
                  <Button
                    size="small"
                    variant="secondary"
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={isPending}
                  >
                    Choose files
                  </Button>
                </div>
              </div>
              {files.length > 0 && (
                <ul className="flex flex-col gap-y-2" aria-label="Selected files">
                  {files.map((item) => (
                    <li
                      key={item.key}
                      className="shadow-elevation-card-rest bg-ui-bg-component flex items-center gap-x-3 rounded-md px-4 py-3"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-y-2">
                        <div className="flex flex-col">
                          <Text
                            size="small"
                            leading="compact"
                            weight="plus"
                            className="truncate"
                          >
                            {item.file.name}
                          </Text>
                          <Text
                            size="small"
                            leading="compact"
                            className="text-ui-fg-subtle"
                          >
                            {formatFileSize(item.file.size)}
                          </Text>
                        </div>
                        <Input
                          size="small"
                          aria-label={`Alt text for ${item.file.name}`}
                          placeholder="Alt text (optional)"
                          value={item.alt}
                          onChange={(e) => setAlt(item.key, e.target.value)}
                          disabled={isPending}
                        />
                      </div>
                      <IconButton
                        size="small"
                        variant="transparent"
                        type="button"
                        aria-label={`Remove ${item.file.name}`}
                        onClick={() => removeFile(item.key)}
                        disabled={isPending}
                      >
                        <Trash />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </FocusModal.Body>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}
