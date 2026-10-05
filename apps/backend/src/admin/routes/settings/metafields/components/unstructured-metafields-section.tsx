import { PlusMini, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
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
import { useEffect, useMemo, useState } from "react"
import { METAFIELD_TYPE_LABELS } from "../../../../lib/metafield-form"
import {
  AdminUnstructuredMetafield,
  deleteUnstructuredMetafieldValues,
  listUnstructuredMetafields,
  metafieldQueryKeys,
} from "../../../../lib/metafields"
import { CreateMetafieldDefinitionInitial } from "./create-metafield-definition-modal"

const PAGE_SIZE = 20

const columnHelper = createDataTableColumnHelper<AdminUnstructuredMetafield>()

const valuesLabel = (count: number) =>
  count === 1 ? "1 value" : `${count} values`

type UnstructuredMetafieldsSectionProps = {
  ownerType: string
  onCreateDefinition: (initial: CreateMetafieldDefinitionInitial) => void
}

// Keys with values but no definition: give them a definition again, or
// delete all their values.
export const UnstructuredMetafieldsSection = ({
  ownerType,
  onCreateDefinition,
}: UnstructuredMetafieldsSectionProps) => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const prompt = usePrompt()
  const queryClient = useQueryClient()

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [ownerType])

  const params = {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  }

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    isPlaceholderData,
  } = useQuery({
    queryKey: metafieldQueryKeys.unstructuredList(ownerType, params),
    queryFn: () => listUnstructuredMetafields(ownerType, params),
    placeholderData: keepPreviousData,
  })

  // Deleting the only key of the last page leaves the current page past the
  // end; move back to the new last page instead of showing an empty one.
  const lastPageIndex = data
    ? Math.max(0, Math.ceil(data.count / pagination.pageSize) - 1)
    : 0

  useEffect(() => {
    if (data && !isPlaceholderData && pagination.pageIndex > lastPageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: lastPageIndex }))
    }
  }, [data, isPlaceholderData, lastPageIndex, pagination.pageIndex])

  const { mutate: remove } = useMutation({
    mutationFn: (row: AdminUnstructuredMetafield) =>
      deleteUnstructuredMetafieldValues(row.owner_type, row.key),
    onSuccess: ({ values_deleted }, row) => {
      queryClient.invalidateQueries({ queryKey: metafieldQueryKeys.all })
      toast.success(`Deleted ${valuesLabel(values_deleted)} of ${row.key}`)
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete the values")
    },
  })

  const columns = useMemo(() => {
    const handleDelete = async (row: AdminUnstructuredMetafield) => {
      const confirmed = await prompt({
        title: "Delete all values?",
        description: `The ${valuesLabel(row.values_count)} stored under ${row.key} will be deleted from every item. This can't be undone.`,
        confirmText: "Delete",
        cancelText: "Cancel",
      })

      if (confirmed) {
        remove(row)
      }
    }

    return [
      columnHelper.accessor("key", {
        header: "Key",
        cell: ({ getValue }) => (
          <Text size="small" leading="compact" className="truncate font-mono">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("type", {
        header: "Type",
        cell: ({ getValue }) => METAFIELD_TYPE_LABELS[getValue()],
      }),
      columnHelper.accessor("values_count", {
        header: "Values",
        cell: ({ getValue }) => getValue(),
      }),
      columnHelper.action({
        actions: ({ row }) => [
          {
            label: "Create definition",
            icon: <PlusMini />,
            onClick: () =>
              onCreateDefinition({
                key: row.original.key,
                type: row.original.type,
              }),
          },
          {
            label: "Delete values",
            icon: <Trash />,
            onClick: () => handleDelete(row.original),
          },
        ],
      }),
    ]
  }, [prompt, remove, onCreateDefinition])

  const table = useDataTable({
    data: data?.unstructured_metafields ?? [],
    columns,
    getRowId: (row) => `${row.key}:${row.type}`,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <Container className="divide-y p-0" data-testid="unstructured-metafields">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start gap-y-1 px-6 py-4">
          <Heading level="h2">Unstructured metafields</Heading>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Values whose definition was deleted. They are hidden from the
            storefront until a definition with the same key and type
            connects them again.
          </Text>
        </DataTable.Toolbar>
        {isError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-y-3 px-6 py-12"
          >
            <Text size="small" leading="compact" weight="plus">
              The unstructured metafields could not be loaded
            </Text>
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {error?.message || "Unexpected error"}
            </Text>
            <Button
              size="small"
              variant="secondary"
              onClick={() => refetch()}
              isLoading={isFetching}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <DataTable.Table
              emptyState={{
                empty: {
                  heading: "No unstructured metafields",
                  description: "Every stored value has a definition.",
                },
              }}
            />
            <DataTable.Pagination />
          </>
        )}
      </DataTable>
    </Container>
  )
}
