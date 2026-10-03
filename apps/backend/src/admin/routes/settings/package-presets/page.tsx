import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CheckCircle, Trash } from "@medusajs/icons"
import {
  Badge,
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
import {
  AdminPackagePreset,
  deletePackagePreset,
  formatPackageDimensions,
  formatPackageWeight,
  listPackagePresets,
  packagePresetQueryKeys,
  setDefaultPackagePreset,
} from "../../../lib/package-presets"
import { CreatePackagePresetModal } from "./components/create-package-preset-modal"

const PAGE_SIZE = 20

const columnHelper = createDataTableColumnHelper<AdminPackagePreset>()

const PackagePresetsPage = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const prompt = usePrompt()
  const queryClient = useQueryClient()

  const params = {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    order: "-created_at",
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
    queryKey: packagePresetQueryKeys.list(params),
    queryFn: () => listPackagePresets(params),
    placeholderData: keepPreviousData,
  })

  // Deleting the only preset of the last page leaves the current page past
  // the end; move back to the new last page instead of showing an empty one.
  const lastPageIndex = data
    ? Math.max(0, Math.ceil(data.count / pagination.pageSize) - 1)
    : 0

  useEffect(() => {
    if (data && !isPlaceholderData && pagination.pageIndex > lastPageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: lastPageIndex }))
    }
  }, [data, isPlaceholderData, lastPageIndex, pagination.pageIndex])

  const { mutate: makeDefault } = useMutation({
    mutationFn: (preset: AdminPackagePreset) =>
      setDefaultPackagePreset(preset.id),
    onSuccess: ({ package_preset }) => {
      queryClient.invalidateQueries({ queryKey: packagePresetQueryKeys.all })
      toast.success(`"${package_preset.name}" is now the default`)
    },
    // A 409 means another preset became the default at the same time.
    onError: (err: Error) => {
      toast.error(err.message || "Failed to set the default package preset")
    },
  })

  const { mutate: remove } = useMutation({
    mutationFn: (preset: AdminPackagePreset) => deletePackagePreset(preset.id),
    onSuccess: (_, preset) => {
      queryClient.invalidateQueries({ queryKey: packagePresetQueryKeys.all })
      toast.success(`"${preset.name}" deleted`)
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete package preset")
    },
  })

  const columns = useMemo(() => {
    const handleDelete = async (preset: AdminPackagePreset) => {
      const confirmed = await prompt({
        title: "Delete package preset?",
        description: preset.is_default
          ? `"${preset.name}" is the default preset. After deleting it there is no default until you set another one.`
          : `"${preset.name}" will be deleted.`,
        confirmText: "Delete",
        cancelText: "Cancel",
      })

      if (confirmed) {
        remove(preset)
      }
    }

    return [
      columnHelper.accessor("name", {
        header: "Name",
        cell: ({ getValue }) => (
          <Text size="small" leading="compact" className="truncate">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.display({
        id: "dimensions",
        header: "Dimensions (L × W × H)",
        cell: ({ row }) => formatPackageDimensions(row.original),
      }),
      columnHelper.display({
        id: "weight",
        header: "Empty weight",
        cell: ({ row }) => formatPackageWeight(row.original),
      }),
      columnHelper.accessor("is_default", {
        header: "Default",
        cell: ({ getValue }) =>
          getValue() ? (
            <Badge size="2xsmall" color="green">
              Default
            </Badge>
          ) : (
            "-"
          ),
      }),
      columnHelper.action({
        actions: ({ row }) => [
          ...(row.original.is_default
            ? []
            : [
                {
                  label: "Set as default",
                  icon: <CheckCircle />,
                  onClick: () => makeDefault(row.original),
                },
              ]),
          {
            label: "Delete",
            icon: <Trash />,
            onClick: () => handleDelete(row.original),
          },
        ],
      }),
    ]
  }, [prompt, remove, makeDefault])

  const table = useDataTable({
    data: data?.package_presets ?? [],
    columns,
    getRowId: (preset) => preset.id,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 px-6 py-4 md:flex-row md:items-center">
          <div className="flex flex-col gap-y-1">
            <Heading>Package presets</Heading>
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Boxes and envelopes you ship orders in.
            </Text>
          </div>
          <CreatePackagePresetModal />
        </DataTable.Toolbar>
        {isError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-y-3 px-6 py-12"
          >
            <Text size="small" leading="compact" weight="plus">
              The package presets could not be loaded
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
            <DataTable.Table />
            <DataTable.Pagination />
          </>
        )}
      </DataTable>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Package presets",
})

export default PackagePresetsPage
