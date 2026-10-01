import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import {
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  StatusBadge,
  useDataTable,
} from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { AdminBrand, brandQueryKeys, listBrands } from "../../lib/brands"
import { CreateBrandModal } from "./components/create-brand-modal"

const PAGE_SIZE = 20

const columnHelper = createDataTableColumnHelper<AdminBrand>()

const columns = [
  columnHelper.accessor("name", {
    header: "Name",
  }),
  columnHelper.accessor("handle", {
    header: "Handle",
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
]

const BrandsPage = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  const params = {
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    order: "-created_at",
  }

  const { data, isLoading } = useQuery({
    queryKey: brandQueryKeys.list(params),
    queryFn: () => listBrands(params),
    placeholderData: keepPreviousData,
  })

  const table = useDataTable({
    data: data?.brands ?? [],
    columns,
    getRowId: (brand) => brand.id,
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
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <Heading>Brands</Heading>
          <CreateBrandModal />
        </DataTable.Toolbar>
        <DataTable.Table />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Brands",
  icon: Tag,
})

export default BrandsPage
