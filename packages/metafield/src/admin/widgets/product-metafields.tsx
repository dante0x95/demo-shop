import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Spinner } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { EditProductMetafieldsDrawer } from "../components/product-metafields/edit-product-metafields-drawer"
import {
  buildProductMetafieldFields,
  formatMetafieldValue,
} from "../lib/metafield-form"
import {
  listAllMetafieldDefinitions,
  listProductMetafields,
  metafieldQueryKeys,
  PRODUCT_OWNER_TYPE,
} from "../lib/metafields"

const ProductMetafieldsWidget = ({
  data: product,
}: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const [editOpen, setEditOpen] = useState(false)

  const definitionsQuery = useQuery({
    queryKey: metafieldQueryKeys.allDefinitions(PRODUCT_OWNER_TYPE),
    queryFn: () => listAllMetafieldDefinitions(PRODUCT_OWNER_TYPE),
  })

  const valuesQuery = useQuery({
    queryKey: metafieldQueryKeys.product(product.id),
    queryFn: () => listProductMetafields(product.id),
  })

  const fields = useMemo(
    () =>
      definitionsQuery.data && valuesQuery.data
        ? buildProductMetafieldFields(
            definitionsQuery.data,
            valuesQuery.data.metafields
          )
        : [],
    [definitionsQuery.data, valuesQuery.data]
  )

  const isLoading = definitionsQuery.isLoading || valuesQuery.isLoading
  const failed = definitionsQuery.isError ? definitionsQuery : valuesQuery

  return (
    <Container className="divide-y p-0" data-testid="product-metafields-widget">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Metafields</Heading>
        {fields.length > 0 && (
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
            aria-label="Loading metafields"
            className="text-ui-fg-subtle animate-spin"
          />
        </div>
      ) : failed.isError ? (
        <div role="alert" className="flex flex-col gap-y-3 px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            The metafields could not be loaded
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {failed.error?.message || "Unexpected error"}
          </Text>
          <div>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                definitionsQuery.refetch()
                valuesQuery.refetch()
              }}
              isLoading={definitionsQuery.isFetching || valuesQuery.isFetching}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : fields.length ? (
        fields.map((field) => (
          <div
            key={field.key}
            data-testid={`product-metafield-${field.key}`}
            className="text-ui-fg-subtle grid grid-cols-2 items-start gap-x-4 px-6 py-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Text size="small" leading="compact" weight="plus">
                {field.label}
              </Text>
              {field.unstructured && (
                <Badge size="2xsmall" color="orange">
                  Unstructured
                </Badge>
              )}
            </div>
            <Text
              size="small"
              leading="compact"
              className="whitespace-pre-wrap break-words"
            >
              {formatMetafieldValue(field.value)}
            </Text>
          </div>
        ))
      ) : (
        <div className="flex flex-col gap-y-1 px-6 py-4">
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            No metafield definitions for products yet.
          </Text>
          <Link
            to="/settings/metafields"
            className="text-ui-fg-interactive txt-compact-small hover:text-ui-fg-interactive-hover"
          >
            Create one in Settings
          </Link>
        </div>
      )}
      <EditProductMetafieldsDrawer
        productId={product.id}
        fields={fields}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details",
})

export default ProductMetafieldsWidget
