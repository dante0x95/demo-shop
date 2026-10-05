import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Spinner } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { ReactNode, useState } from "react"
import { EditProductPackageDrawer } from "../components/package-preset/edit-product-package-drawer"
import { productPackageSource } from "../components/package-preset/utils"
import {
  formatPackageDimensions,
  formatPackageWeight,
  productPackagePresetQueryKeys,
  retrieveProductPackagePreset,
} from "../lib/package-presets"

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
    <Text size="small" leading="compact" weight="plus">
      {label}
    </Text>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
)

const Value = ({ children }: { children: ReactNode }) => (
  <Text size="small" leading="compact">
    {children}
  </Text>
)

const ProductPackagePresetWidget = ({
  data: product,
}: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const [editOpen, setEditOpen] = useState(false)
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: productPackagePresetQueryKeys.detail(product.id),
    queryFn: () => retrieveProductPackagePreset(product.id),
  })

  const view = data?.product_package_preset
  const preset = view?.resolved ?? null
  const source = view ? productPackageSource(view) : null

  return (
    <Container className="divide-y p-0" data-testid="product-package-widget">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Package</Heading>
        {view && (
          <Button
            size="small"
            variant="secondary"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="flex justify-center px-6 py-4">
          <Spinner
            aria-label="Loading package"
            className="text-ui-fg-subtle animate-spin"
          />
        </div>
      ) : isError || !view ? (
        <div role="alert" className="flex flex-col gap-y-3 px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            The package could not be loaded
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {error?.message || "Unexpected error"}
          </Text>
          <div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => refetch()}
              isLoading={isFetching}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Row label="Shipped alone in">
            {preset ? <Value>{preset.name}</Value> : <Value>No package</Value>}
            {source === "store_default" && (
              <Badge size="2xsmall" color="grey">
                Store default
              </Badge>
            )}
          </Row>
          {preset ? (
            <>
              <Row label="Dimensions">
                <Value>{formatPackageDimensions(preset)}</Value>
              </Row>
              <Row label="Empty weight">
                <Value>{formatPackageWeight(preset)}</Value>
              </Row>
            </>
          ) : (
            <div className="px-6 py-4">
              <Text
                size="small"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                The store has no default package. Pick one for this product, or
                set a default in Settings → Package presets.
              </Text>
            </div>
          )}
          <EditProductPackageDrawer
            view={view}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side",
})

export default ProductPackagePresetWidget
