import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Spinner } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { ReactNode, useState } from "react"
import { EditProductSeoDrawer } from "../components/product-seo/edit-product-seo-drawer"
import { productSeoFallbacks } from "../components/product-seo/utils"
import { productSeoQueryKeys, retrieveProductSeo } from "../lib/product-seo"

const Row = ({
  label,
  value,
  usesFallback,
  fallbackLabel,
}: {
  label: string
  value: ReactNode
  usesFallback: boolean
  fallbackLabel: string
}) => (
  <div className="text-ui-fg-subtle grid grid-cols-2 items-start gap-x-4 px-6 py-4">
    <Text size="small" leading="compact" weight="plus">
      {label}
    </Text>
    <div className="flex flex-col items-start gap-y-1">
      <Text size="small" leading="compact" className="break-words">
        {value}
      </Text>
      {usesFallback && (
        <Badge size="2xsmall" color="grey">
          {fallbackLabel}
        </Badge>
      )}
    </div>
  </div>
)

const ProductSeoWidget = ({
  data: product,
}: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const [editOpen, setEditOpen] = useState(false)
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: productSeoQueryKeys.detail(product.id),
    queryFn: () => retrieveProductSeo(product.id),
  })

  const seo = data?.product_seo

  return (
    <Container className="divide-y p-0" data-testid="product-seo-widget">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col">
          <Heading level="h2">Search engine listing</Heading>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Page title and meta description. The URL uses the product's handle.
          </Text>
        </div>
        {seo && (
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
            aria-label="Loading SEO"
            className="text-ui-fg-subtle animate-spin"
          />
        </div>
      ) : isError || !seo ? (
        <div role="alert" className="flex flex-col gap-y-3 px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            The SEO could not be loaded
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
          <Row
            label="Page title"
            value={seo.resolved.title}
            usesFallback={seo.title == null}
            fallbackLabel="From product title"
          />
          <Row
            label="Meta description"
            value={seo.resolved.description ?? "-"}
            usesFallback={
              seo.description == null && seo.resolved.description != null
            }
            fallbackLabel="From product description"
          />
          <EditProductSeoDrawer
            seo={seo}
            fallbacks={productSeoFallbacks(product)}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details",
})

export default ProductSeoWidget
