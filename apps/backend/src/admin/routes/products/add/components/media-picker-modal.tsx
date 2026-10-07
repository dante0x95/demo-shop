import { Photo } from "@medusajs/icons"
import {
  Button,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DataTableRowSelectionState,
  FocusModal,
  Heading,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
  AdminMediaAsset,
  listMediaAssets,
  mediaQueryKeys,
} from "../../../../lib/media"

const PAGE_SIZE = 10

const columnHelper = createDataTableColumnHelper<AdminMediaAsset>()

const columns = [
  columnHelper.select(),
  columnHelper.display({
    id: "preview",
    header: "Preview",
    cell: ({ row }) => (
      <div className="bg-ui-bg-component border-ui-border-base flex size-10 items-center justify-center overflow-hidden rounded-md border">
        {row.original.url ? (
          <img
            src={row.original.url}
            alt={row.original.alt ?? ""}
            className="h-full w-full object-cover"
          />
        ) : (
          <Photo className="text-ui-fg-subtle" />
        )}
      </div>
    ),
  }),
  columnHelper.accessor("filename", { header: "Filename" }),
  columnHelper.accessor("alt", {
    header: "Alt text",
    cell: ({ getValue }) => getValue() || "-",
  }),
]

// Picks media from the library, across pages and searches. Media the product
// already has are skipped when the picked ones are added.
export const MediaPickerModal = ({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (assets: AdminMediaAsset[]) => void
}) => {
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [picked, setPicked] = useState<Record<string, AdminMediaAsset>>({})

  const params = {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    order: "-created_at",
    ...(search.trim() ? { q: search.trim() } : {}),
  }

  const { data, isLoading } = useQuery({
    queryKey: mediaQueryKeys.list(params),
    queryFn: () => listMediaAssets(params),
    placeholderData: keepPreviousData,
    enabled: open,
  })

  const rowSelection = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(picked).map((id) => [id, true])
      ) as DataTableRowSelectionState,
    [picked]
  )

  const assets = data?.media_assets ?? []

  const table = useDataTable({
    data: assets,
    columns,
    getRowId: (asset) => asset.id,
    rowCount: data?.count ?? 0,
    isLoading,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: (selection) => {
        // Rows of other pages stay picked; this page's rows follow the table.
        setPicked((prev) => {
          const next = { ...prev }

          for (const asset of assets) {
            if (selection[asset.id]) {
              next[asset.id] = asset
            } else {
              delete next[asset.id]
            }
          }

          return next
        })
      },
    },
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value)
        setPagination((prev) => ({ ...prev, pageIndex: 0 }))
      },
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)

    if (!next) {
      setPicked({})
      setSearch("")
      setPagination({ pageIndex: 0, pageSize: PAGE_SIZE })
    }
  }

  const pickedCount = Object.keys(picked).length

  return (
    <FocusModal open={open} onOpenChange={handleOpenChange}>
      <FocusModal.Content>
        <div className="flex h-full flex-col overflow-hidden">
          <FocusModal.Header>
            <div className="flex items-center justify-end gap-x-2">
              <FocusModal.Close asChild>
                <Button size="small" variant="secondary" type="button">
                  Cancel
                </Button>
              </FocusModal.Close>
              <Button
                size="small"
                type="button"
                disabled={!pickedCount}
                onClick={() => {
                  onPick(Object.values(picked))
                  handleOpenChange(false)
                }}
              >
                {pickedCount ? `Add ${pickedCount} selected` : "Add selected"}
              </Button>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-1 flex-col items-center overflow-y-auto py-16">
            <div className="flex w-full max-w-[720px] flex-col gap-y-6">
              <div className="flex flex-col gap-y-1">
                <Heading>Choose from the media library</Heading>
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-subtle"
                >
                  Selected media are added to the product in the order you pick
                  them.
                </Text>
              </div>
              <DataTable instance={table}>
                <DataTable.Toolbar className="px-0 pb-4">
                  <DataTable.Search placeholder="Search filename or alt text" />
                </DataTable.Toolbar>
                <DataTable.Table />
                <DataTable.Pagination />
              </DataTable>
            </div>
          </FocusModal.Body>
        </div>
      </FocusModal.Content>
    </FocusModal>
  )
}
