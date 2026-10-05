import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Spinner } from "@medusajs/icons"
import { Button, Container, Heading, Table, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { EditVariantPricingDrawer } from "../components/variant-pricing/edit-variant-pricing-drawer"
import {
  compareAtHiddenReason,
  formatAmount,
} from "../components/variant-pricing/utils"
import {
  retrieveVariantPricing,
  variantPricingQueryKeys,
} from "../lib/variant-pricing"

const ProductVariantPricingWidget = ({
  data: product,
}: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const [editOpen, setEditOpen] = useState(false)
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: variantPricingQueryKeys.detail(product.id),
    queryFn: () => retrieveVariantPricing(product.id),
  })

  const pricing = data?.variant_pricing
  const currency = pricing?.currency_code ?? null

  return (
    <Container
      className="divide-y p-0"
      data-testid="product-variant-pricing-widget"
    >
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col">
          <Heading level="h2">Compare-at price and cost</Heading>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Per variant. Customers never see the cost per item.
          </Text>
        </div>
        {pricing && (
          <Button
            size="small"
            variant="secondary"
            disabled={!pricing.variants.length}
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="flex justify-center px-6 py-4">
          <Spinner
            aria-label="Loading compare-at prices and costs"
            className="text-ui-fg-subtle animate-spin"
          />
        </div>
      ) : isError || !pricing ? (
        <div role="alert" className="flex flex-col gap-y-3 px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            The compare-at prices and costs could not be loaded
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
      ) : !pricing.variants.length ? (
        <div className="px-6 py-4">
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            This product has no variants yet.
          </Text>
        </div>
      ) : (
        <>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Variant</Table.HeaderCell>
                <Table.HeaderCell>Price</Table.HeaderCell>
                <Table.HeaderCell>Compare-at price</Table.HeaderCell>
                <Table.HeaderCell>Cost per item</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {pricing.variants.map((variant) => {
                const hiddenReason = compareAtHiddenReason(
                  variant.compare_at_amount,
                  variant.price
                )

                return (
                  <Table.Row key={variant.variant_id}>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span>{variant.title}</span>
                        {variant.sku && (
                          <span className="text-ui-fg-subtle">
                            {variant.sku}
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{formatAmount(variant.price, currency)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span>
                          {formatAmount(variant.compare_at_amount, currency)}
                        </span>
                        {hiddenReason && (
                          <span className="text-ui-fg-subtle txt-compact-xsmall">
                            {hiddenReason}
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {formatAmount(variant.cost_amount, currency)}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
          <EditVariantPricingDrawer
            pricing={pricing}
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

export default ProductVariantPricingWidget
