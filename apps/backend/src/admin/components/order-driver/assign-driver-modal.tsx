import {
  Button,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  FocusModal,
  Heading,
  Select,
  StatusBadge,
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
import { useMemo, useState } from "react"
import { AdminDriver, driverQueryKeys, listDrivers } from "../../lib/drivers"
import { assignOrderDriver, orderDriverQueryKeys } from "../../lib/order-driver"
import {
  DRIVER_STATUS_FILTERS,
  DriverStatusFilter,
  formatDriverName,
  statusFilterToQuery,
  vehicleTypeLabel,
} from "../../routes/drivers/utils"
import { assignButtonLabel } from "./utils"

const PAGE_SIZE = 10

const columnHelper = createDataTableColumnHelper<AdminDriver>()

type AssignDriverModalProps = {
  orderId: string
  orderDisplayId: number
  currentDriverId: string | null
}

export const AssignDriverModal = ({
  orderId,
  orderDisplayId,
  currentDriverId,
}: AssignDriverModalProps) => {
  const [open, setOpen] = useState(false)
  // Only active drivers can take orders, so they are listed first. The other
  // statuses stay one click away; the API explains why an inactive one fails.
  const [status, setStatus] = useState<DriverStatusFilter>("active")
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const params = {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    order: "-created_at",
    ...statusFilterToQuery(status),
  }

  // Selection data: only loaded while the modal is open.
  const { data, isLoading, isError, error: listError } = useQuery({
    queryKey: driverQueryKeys.list(params),
    queryFn: () => listDrivers(params),
    placeholderData: keepPreviousData,
    enabled: open,
  })

  const {
    mutate: assign,
    isPending,
    variables: pendingDriver,
  } = useMutation({
    mutationFn: (driver: AdminDriver) => assignOrderDriver(orderId, driver.id),
    onSuccess: (_, driver) => {
      queryClient.invalidateQueries({
        queryKey: orderDriverQueryKeys.detail(orderId),
      })
      toast.success(
        `${formatDriverName(driver)} will deliver order #${orderDisplayId}`
      )
      handleOpenChange(false)
    },
    // A 400 says why: inactive driver, or an order that is canceled,
    // completed or already delivered.
    onError: (err: Error) => {
      setError(err.message || "Failed to assign the driver")
    },
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)

    if (!next) {
      setError(null)
      setStatus("active")
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "name",
        header: "Name",
        cell: ({ row }) => (
          <Text size="small" leading="compact" className="truncate">
            {formatDriverName(row.original)}
          </Text>
        ),
      }),
      columnHelper.accessor("email", {
        header: "Email",
      }),
      columnHelper.accessor("vehicle_type", {
        header: "Vehicle",
        cell: ({ getValue }) => vehicleTypeLabel(getValue()),
      }),
      columnHelper.accessor("is_active", {
        header: "Status",
        cell: ({ getValue }) =>
          getValue() ? (
            <StatusBadge color="green">Active</StatusBadge>
          ) : (
            <StatusBadge color="grey">Inactive</StatusBadge>
          ),
      }),
      columnHelper.display({
        id: "assign",
        cell: ({ row }) => {
          const driver = row.original
          const isCurrent = driver.id === currentDriverId

          return (
            <div className="flex justify-end">
              <Button
                size="small"
                variant="secondary"
                disabled={isCurrent || isPending}
                isLoading={isPending && pendingDriver?.id === driver.id}
                onClick={() => {
                  setError(null)
                  assign(driver)
                }}
              >
                {isCurrent ? "Assigned" : "Assign"}
              </Button>
            </div>
          )
        },
      }),
    ],
    [assign, currentDriverId, isPending, pendingDriver]
  )

  const table = useDataTable({
    data: data?.drivers ?? [],
    columns,
    getRowId: (driver) => driver.id,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  return (
    <FocusModal open={open} onOpenChange={handleOpenChange}>
      <FocusModal.Trigger asChild>
        <Button size="small" variant="secondary">
          {assignButtonLabel(!!currentDriverId)}
        </Button>
      </FocusModal.Trigger>
      <FocusModal.Content>
        <div className="flex h-full flex-col overflow-hidden">
          <FocusModal.Header>
            <div className="flex items-center justify-end gap-x-2">
              <FocusModal.Close asChild>
                <Button size="small" variant="secondary" disabled={isPending}>
                  Cancel
                </Button>
              </FocusModal.Close>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-1 flex-col items-center overflow-y-auto py-16">
            <div className="flex w-full max-w-[720px] flex-col gap-y-8">
              <div className="flex flex-col gap-y-1">
                <Heading>{assignButtonLabel(!!currentDriverId)}</Heading>
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-subtle"
                >
                  Pick the driver who delivers order #{orderDisplayId}. It
                  replaces the current driver, if any.
                </Text>
              </div>
              {error && (
                <div
                  role="alert"
                  className="bg-ui-bg-subtle shadow-borders-base rounded-md px-4 py-3"
                >
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-error"
                  >
                    {error}
                  </Text>
                </div>
              )}
              <div className="shadow-elevation-card-rest bg-ui-bg-base overflow-hidden rounded-lg">
                <DataTable instance={table}>
                  <DataTable.Toolbar className="flex items-center justify-between gap-2 px-6 py-4">
                    <Text size="small" leading="compact" weight="plus">
                      Drivers
                    </Text>
                    <Select
                      size="small"
                      value={status}
                      onValueChange={(value) => {
                        setStatus(value as DriverStatusFilter)
                        setPagination((prev) => ({ ...prev, pageIndex: 0 }))
                      }}
                    >
                      <Select.Trigger
                        aria-label="Driver status"
                        className="w-[140px]"
                      >
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {DRIVER_STATUS_FILTERS.map(({ value, label }) => (
                          <Select.Item key={value} value={value}>
                            {label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </DataTable.Toolbar>
                  {isError ? (
                    <div className="flex flex-col items-center gap-y-1 px-6 py-12">
                      <Text size="small" leading="compact" weight="plus">
                        The drivers could not be loaded
                      </Text>
                      <Text
                        size="small"
                        leading="compact"
                        className="text-ui-fg-subtle"
                      >
                        {listError?.message || "Unexpected error"}
                      </Text>
                    </div>
                  ) : (
                    <>
                      <DataTable.Table />
                      <DataTable.Pagination />
                    </>
                  )}
                </DataTable>
              </div>
            </div>
          </FocusModal.Body>
        </div>
      </FocusModal.Content>
    </FocusModal>
  )
}
