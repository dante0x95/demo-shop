import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Eye, EyeSlash, Spinner, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  Select,
  Text,
  toast,
  useDataTable,
} from "@medusajs/ui"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  METAFIELD_TYPE_LABELS,
  ownerTypeLabel,
} from "../../../lib/metafield-form"
import {
  AdminMetafieldDefinition,
  deleteMetafieldDefinition,
  getMetafieldConfig,
  listMetafieldDefinitions,
  metafieldQueryKeys,
  updateMetafieldDefinitionStorefrontAccess,
} from "../../../lib/metafields"
import {
  CreateMetafieldDefinitionInitial,
  CreateMetafieldDefinitionModal,
} from "./components/create-metafield-definition-modal"
import { DeleteMetafieldDefinitionPrompt } from "./components/delete-metafield-definition-prompt"
import { UnstructuredMetafieldsSection } from "./components/unstructured-metafields-section"

const PAGE_SIZE = 20

const columnHelper = createDataTableColumnHelper<AdminMetafieldDefinition>()

const LoadError = ({
  title,
  error,
  onRetry,
  isRetrying,
}: {
  title: string
  error: Error | null
  onRetry: () => void
  isRetrying: boolean
}) => (
  <div role="alert" className="flex flex-col items-center gap-y-3 px-6 py-12">
    <Text size="small" leading="compact" weight="plus">
      {title}
    </Text>
    <Text size="small" leading="compact" className="text-ui-fg-subtle">
      {error?.message || "Unexpected error"}
    </Text>
    <Button
      size="small"
      variant="secondary"
      onClick={onRetry}
      isLoading={isRetrying}
    >
      Retry
    </Button>
  </div>
)

const DefinitionsSection = ({
  ownerType,
  ownerTypes,
  onOwnerTypeChange,
  onCreate,
}: {
  ownerType: string
  ownerTypes: string[]
  onOwnerTypeChange: (ownerType: string) => void
  onCreate: () => void
}) => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [toDelete, setToDelete] = useState<AdminMetafieldDefinition | null>(
    null
  )
  const queryClient = useQueryClient()

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [ownerType])

  const params = {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    owner_type: ownerType,
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
    queryKey: metafieldQueryKeys.definitionList(params),
    queryFn: () => listMetafieldDefinitions(params),
    placeholderData: keepPreviousData,
  })

  // Deleting the only definition of the last page leaves the current page
  // past the end; move back to the new last page.
  const lastPageIndex = data
    ? Math.max(0, Math.ceil(data.count / pagination.pageSize) - 1)
    : 0

  useEffect(() => {
    if (data && !isPlaceholderData && pagination.pageIndex > lastPageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: lastPageIndex }))
    }
  }, [data, isPlaceholderData, lastPageIndex, pagination.pageIndex])

  const { mutate: setStorefrontAccess } = useMutation({
    mutationFn: ({
      definition,
      storefront_access,
    }: {
      definition: AdminMetafieldDefinition
      storefront_access: boolean
    }) =>
      updateMetafieldDefinitionStorefrontAccess(
        definition.id,
        storefront_access
      ),
    onSuccess: ({ metafield_definition }) => {
      queryClient.invalidateQueries({ queryKey: metafieldQueryKeys.all })
      toast.success(
        metafield_definition.storefront_access
          ? `"${metafield_definition.label}" is now shown on the storefront`
          : `"${metafield_definition.label}" is now hidden from the storefront`
      )
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to change storefront access")
    },
  })

  const { mutate: remove } = useMutation({
    mutationFn: ({
      definition,
      deleteValues,
    }: {
      definition: AdminMetafieldDefinition
      deleteValues: boolean
    }) => deleteMetafieldDefinition(definition.id, deleteValues),
    onSuccess: (_, { definition, deleteValues }) => {
      queryClient.invalidateQueries({ queryKey: metafieldQueryKeys.all })
      toast.success(
        deleteValues
          ? `"${definition.label}" and its values deleted`
          : `"${definition.label}" deleted`
      )
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete metafield definition")
    },
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor("label", {
        header: "Name",
        cell: ({ getValue }) => (
          <Text size="small" leading="compact" className="truncate">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.accessor("key", {
        header: "Key",
        cell: ({ getValue }) => (
          <Text size="small" leading="compact" className="truncate font-mono">
            {getValue()}
          </Text>
        ),
      }),
      columnHelper.display({
        id: "type",
        header: "Type",
        cell: ({ row }) => {
          const { type, options } = row.original
          const label = METAFIELD_TYPE_LABELS[type]

          return type === "select" && options?.length ? (
            <Text
              size="small"
              leading="compact"
              className="truncate"
              title={options.join(", ")}
            >
              {`${label}: ${options.join(", ")}`}
            </Text>
          ) : (
            label
          )
        },
      }),
      columnHelper.accessor("storefront_access", {
        header: "Storefront",
        cell: ({ getValue }) =>
          getValue() ? (
            <Badge size="2xsmall" color="green">
              Visible
            </Badge>
          ) : (
            <Badge size="2xsmall" color="grey">
              Hidden
            </Badge>
          ),
      }),
      columnHelper.action({
        actions: ({ row }) => [
          row.original.storefront_access
            ? {
                label: "Hide from storefront",
                icon: <EyeSlash />,
                onClick: () =>
                  setStorefrontAccess({
                    definition: row.original,
                    storefront_access: false,
                  }),
              }
            : {
                label: "Show on storefront",
                icon: <Eye />,
                onClick: () =>
                  setStorefrontAccess({
                    definition: row.original,
                    storefront_access: true,
                  }),
              },
          {
            label: "Delete",
            icon: <Trash />,
            onClick: () => setToDelete(row.original),
          },
        ],
      }),
    ],
    [setStorefrontAccess]
  )

  const table = useDataTable({
    data: data?.metafield_definitions ?? [],
    columns,
    getRowId: (definition) => definition.id,
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
            <Heading>Metafields</Heading>
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Custom fields with a fixed type. Values are hidden from the
              storefront unless the definition allows it.
            </Text>
          </div>
          <div className="flex items-center gap-x-2">
            {/* Only worth a picker when the shop configured several. */}
            {ownerTypes.length > 1 && (
              <Select value={ownerType} onValueChange={onOwnerTypeChange}>
                <Select.Trigger aria-label="Owner type" className="w-[160px]">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {ownerTypes.map((type) => (
                    <Select.Item key={type} value={type}>
                      {ownerTypeLabel(type)}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            )}
            <Button size="small" variant="secondary" onClick={onCreate}>
              Create definition
            </Button>
          </div>
        </DataTable.Toolbar>
        {isError ? (
          <LoadError
            title="The metafield definitions could not be loaded"
            error={error}
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        ) : (
          <>
            <DataTable.Table
              emptyState={{
                empty: {
                  heading: "No metafield definitions",
                  description: `Create one to add a custom field to every ${ownerTypeLabel(ownerType).toLowerCase()}.`,
                },
              }}
            />
            <DataTable.Pagination />
          </>
        )}
      </DataTable>
      <DeleteMetafieldDefinitionPrompt
        definition={toDelete}
        onCancel={() => setToDelete(null)}
        onConfirm={(definition, deleteValues) => {
          setToDelete(null)
          remove({ definition, deleteValues })
        }}
      />
    </Container>
  )
}

const MetafieldsPage = () => {
  const [selectedOwnerType, setSelectedOwnerType] = useState<string | null>(
    null
  )
  const [createOpen, setCreateOpen] = useState(false)
  // Kept in state so the modal doesn't reset while it is open.
  const [createInitial, setCreateInitial] =
    useState<CreateMetafieldDefinitionInitial | null>(null)

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: metafieldQueryKeys.config,
    queryFn: getMetafieldConfig,
  })

  const ownerTypes = data?.config.owner_types ?? []
  const ownerType =
    selectedOwnerType && ownerTypes.includes(selectedOwnerType)
      ? selectedOwnerType
      : ownerTypes[0]

  const openCreate = useCallback(
    (initial: CreateMetafieldDefinitionInitial | null = null) => {
      setCreateInitial(initial)
      setCreateOpen(true)
    },
    []
  )

  if (isLoading) {
    return (
      <Container className="flex justify-center px-6 py-12">
        <Spinner
          aria-label="Loading metafields"
          className="text-ui-fg-subtle animate-spin"
        />
      </Container>
    )
  }

  if (isError || !ownerType) {
    return (
      <Container className="p-0">
        <LoadError
          title="The metafield settings could not be loaded"
          error={error}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      </Container>
    )
  }

  return (
    <div className="flex flex-col gap-y-3">
      <DefinitionsSection
        ownerType={ownerType}
        ownerTypes={ownerTypes}
        onOwnerTypeChange={setSelectedOwnerType}
        onCreate={() => openCreate()}
      />
      <UnstructuredMetafieldsSection
        ownerType={ownerType}
        onCreateDefinition={openCreate}
      />
      <CreateMetafieldDefinitionModal
        ownerType={ownerType}
        open={createOpen}
        onOpenChange={setCreateOpen}
        initial={createInitial}
      />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Metafields",
})

export default MetafieldsPage
