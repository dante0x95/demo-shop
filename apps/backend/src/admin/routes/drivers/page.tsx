import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Envelope, TruckFast } from "@medusajs/icons"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  Select,
  StatusBadge,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
  AdminDriver,
  driverQueryKeys,
  listDrivers,
  resendDriverInvite,
} from "../../lib/drivers"
import { CreateDriverModal } from "./components/create-driver-modal"
import {
  DRIVER_STATUS_FILTERS,
  DriverStatusFilter,
  formatDriverName,
  statusFilterToQuery,
  vehicleTypeLabel,
} from "./utils"

const PAGE_SIZE = 20

const columnHelper = createDataTableColumnHelper<AdminDriver>()

const DriversPage = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [status, setStatus] = useState<DriverStatusFilter>("all")
  const prompt = usePrompt()

  const params = {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    order: "-created_at",
    ...statusFilterToQuery(status),
  }

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: driverQueryKeys.list(params),
    queryFn: () => listDrivers(params),
    placeholderData: keepPreviousData,
  })

  const { mutate: resendInvite } = useMutation({
    mutationFn: (driver: AdminDriver) => resendDriverInvite(driver.id),
    // Nothing shown in the table changes, so there is nothing to refetch.
    onSuccess: ({ driver }) => {
      toast.success(`Invitation sent to ${driver.email}`)
    },
    // A 400 explains that the driver already has a login.
    onError: (err: Error) => {
      toast.error(err.message || "Failed to resend the invitation")
    },
  })

  const columns = useMemo(() => {
    const handleResend = async (driver: AdminDriver) => {
      const confirmed = await prompt({
        title: "Resend invitation?",
        description: `A new link to set a password is emailed to ${driver.email}. The previous link stops working.`,
        confirmText: "Resend",
        cancelText: "Cancel",
      })

      if (confirmed) {
        resendInvite(driver)
      }
    }

    return [
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
      columnHelper.accessor("phone", {
        header: "Phone",
      }),
      columnHelper.accessor("vehicle_type", {
        header: "Vehicle",
        cell: ({ getValue }) => vehicleTypeLabel(getValue()),
      }),
      columnHelper.accessor("license_plate", {
        header: "License plate",
        cell: ({ getValue }) => getValue() || "-",
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
      columnHelper.action({
        actions: [
          {
            label: "Resend invitation",
            icon: <Envelope />,
            onClick: ({ row }) => handleResend(row.original),
          },
        ],
      }),
    ]
  }, [prompt, resendInvite])

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
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 px-6 py-4 md:flex-row md:items-center">
          <Heading>Drivers</Heading>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <Select
              size="small"
              value={status}
              onValueChange={(value) => {
                setStatus(value as DriverStatusFilter)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
            >
              <Select.Trigger aria-label="Status" className="w-[140px]">
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
            <CreateDriverModal />
          </div>
        </DataTable.Toolbar>
        {isError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-y-3 px-6 py-12"
          >
            <Text size="small" leading="compact" weight="plus">
              The drivers could not be loaded
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
  label: "Drivers",
  icon: TruckFast,
})

export default DriversPage
