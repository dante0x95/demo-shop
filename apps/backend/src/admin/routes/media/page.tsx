import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Photo, Trash } from "@medusajs/icons"
import {
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  Select,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
  AdminMediaAsset,
  deleteMediaAsset,
  listMediaAssets,
  MEDIA_MIME_TYPES,
  mediaQueryKeys,
  mediaTypeLabel,
} from "../../lib/media"
import { UploadMediaModal } from "./components/upload-media-modal"
import { formatFileSize } from "./utils"

const PAGE_SIZE = 20

const ALL_TYPES = "all"

const columnHelper = createDataTableColumnHelper<AdminMediaAsset>()

const Preview = ({ asset }: { asset: AdminMediaAsset }) => (
  <div className="bg-ui-bg-component border-ui-border-base flex size-10 items-center justify-center overflow-hidden rounded-md border">
    {asset.url ? (
      <img
        src={asset.url}
        alt={asset.alt ?? ""}
        className="h-full w-full object-cover"
      />
    ) : (
      <Photo className="text-ui-fg-subtle" />
    )}
  </div>
)

const MediaPage = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [search, setSearch] = useState("")
  const [mimeType, setMimeType] = useState(ALL_TYPES)
  const prompt = usePrompt()
  const queryClient = useQueryClient()

  const params = {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    order: "-created_at",
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(mimeType !== ALL_TYPES ? { mime_type: mimeType } : {}),
  }

  const { data, isLoading } = useQuery({
    queryKey: mediaQueryKeys.list(params),
    queryFn: () => listMediaAssets(params),
    placeholderData: keepPreviousData,
  })

  const { mutate: remove } = useMutation({
    mutationFn: (asset: AdminMediaAsset) => deleteMediaAsset(asset.id),
    onSuccess: (_, asset) => {
      queryClient.invalidateQueries({ queryKey: mediaQueryKeys.all })
      toast.success(`"${asset.filename}" deleted`)
    },
    // A 409 explains that products still use the asset.
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete media")
    },
  })

  const columns = useMemo(() => {
    const handleDelete = async (asset: AdminMediaAsset) => {
      const confirmed = await prompt({
        title: "Delete media?",
        description: `"${asset.filename}" will be deleted from the library and from storage. Media used by a product cannot be deleted.`,
        confirmText: "Delete",
        cancelText: "Cancel",
      })

      if (confirmed) {
        remove(asset)
      }
    }

    return [
      columnHelper.display({
        id: "preview",
        header: "Preview",
        cell: ({ row }) => <Preview asset={row.original} />,
      }),
      columnHelper.accessor("filename", {
        header: "Filename",
        cell: ({ getValue }) => (
          <Text size="small" leading="compact" className="truncate">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("alt", {
        header: "Alt text",
        cell: ({ getValue }) => getValue() || "-",
      }),
      columnHelper.accessor("mime_type", {
        header: "Type",
        cell: ({ getValue }) => mediaTypeLabel(getValue()),
      }),
      columnHelper.accessor("size", {
        header: "Size",
        cell: ({ getValue }) => formatFileSize(getValue()),
      }),
      columnHelper.accessor("created_at", {
        header: "Uploaded",
        cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
      }),
      columnHelper.action({
        actions: [
          {
            label: "Delete",
            icon: <Trash />,
            onClick: ({ row }) => handleDelete(row.original),
          },
        ],
      }),
    ]
  }, [prompt, remove])

  const resetPage = () =>
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))

  const table = useDataTable({
    data: data?.media_assets ?? [],
    columns,
    getRowId: (asset) => asset.id,
    rowCount: data?.count ?? 0,
    isLoading,
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value)
        resetPage()
      },
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 px-6 py-4 md:flex-row md:items-center">
          <Heading>Media</Heading>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <DataTable.Search placeholder="Search filename or alt text" />
            <Select
              size="small"
              value={mimeType}
              onValueChange={(value) => {
                setMimeType(value)
                resetPage()
              }}
            >
              <Select.Trigger aria-label="Type" className="w-[140px]">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={ALL_TYPES}>All types</Select.Item>
                {MEDIA_MIME_TYPES.map((type) => (
                  <Select.Item key={type} value={type}>
                    {mediaTypeLabel(type)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <UploadMediaModal />
          </div>
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Media",
  icon: Photo,
})

export default MediaPage
