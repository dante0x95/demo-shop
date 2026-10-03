import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Spinner } from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  StatusBadge,
  Text,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { ReactNode } from "react"
import {
  orderDriverQueryKeys,
  retrieveOrderDriver,
} from "../lib/order-driver"
import {
  formatDriverName,
  vehicleTypeLabel,
} from "../routes/drivers/utils"
import { AssignDriverModal } from "../components/order-driver/assign-driver-modal"
import {
  DELIVERY_STATUS_BADGES,
  orderDeliveryStatus,
} from "../components/order-driver/utils"

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
    <Text size="small" leading="compact" weight="plus">
      {label}
    </Text>
    <div className="flex items-center gap-x-2">{children}</div>
  </div>
)

const Value = ({ children }: { children: ReactNode }) => (
  <Text size="small" leading="compact">
    {children}
  </Text>
)

const OrderDriverWidget = ({
  data: order,
}: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: orderDriverQueryKeys.detail(order.id),
    queryFn: () => retrieveOrderDriver(order.id),
  })

  const driver = data?.driver ?? null
  const deliveryBadge =
    DELIVERY_STATUS_BADGES[orderDeliveryStatus(data?.fulfillments)]

  return (
    <Container className="divide-y p-0" data-testid="order-driver-widget">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Driver</Heading>
        {data && (
          <AssignDriverModal
            orderId={data.id}
            orderDisplayId={data.display_id}
            currentDriverId={driver?.id ?? null}
          />
        )}
      </div>
      {isLoading ? (
        <div className="flex justify-center px-6 py-4">
          <Spinner
            aria-label="Loading driver"
            className="text-ui-fg-subtle animate-spin"
          />
        </div>
      ) : isError ? (
        <div role="alert" className="flex flex-col gap-y-3 px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            The driver could not be loaded
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
          <Row label="Driver">
            {driver ? (
              <>
                <Value>{formatDriverName(driver)}</Value>
                {/* An inactive driver can't confirm the delivery. */}
                {!driver.is_active && (
                  <StatusBadge color="grey">Inactive</StatusBadge>
                )}
              </>
            ) : (
              <Value>No driver assigned</Value>
            )}
          </Row>
          {driver && (
            <>
              <Row label="Phone">
                <Value>{driver.phone}</Value>
              </Row>
              <Row label="Vehicle">
                <Value>{vehicleTypeLabel(driver.vehicle_type)}</Value>
              </Row>
            </>
          )}
          <Row label="Delivery">
            <StatusBadge color={deliveryBadge.color}>
              {deliveryBadge.label}
            </StatusBadge>
          </Row>
        </>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side",
})

export default OrderDriverWidget
