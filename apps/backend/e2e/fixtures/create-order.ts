import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  cancelOrderWorkflow,
  createOrderWorkflow,
  createRegionsWorkflow,
  createStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"
import { ORDER_ID_MARKER } from "./order-id-marker"

const REGION_NAME = "E2E Region"
const LOCATION_NAME = "E2E Warehouse"
const STATES = ["pending", "canceled", "fulfilled", "delivered"] as const
// One unit of one item, delivered whole.
const ITEM_QUANTITY = 1

type OrderState = (typeof STATES)[number]

// Creates an order for E2E specs; storefront checkout isn't part of them.
// Prints the new order's id after ORDER_ID_MARKER, for the spec to read.
// Usage: npx medusa exec ./e2e/fixtures/create-order.ts <email> [pending|canceled|fulfilled|delivered]
//   fulfilled: the order has a shipped fulfillment, not delivered yet.
//   delivered: the order has a fulfillment with `delivered_at` set, as left by
//   a driver confirming the delivery.
export default async function createOrder({ container, args }: ExecArgs) {
  const [email, state = "pending"] = args

  if (!email || !STATES.includes(state as OrderState)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Usage: create-order.ts <email> [${STATES.join("|")}]`
    )
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Specs share the E2E database, so the region is created once.
  const {
    data: [existingRegion],
  } = await query.graph({
    entity: "region",
    fields: ["id"],
    filters: { name: REGION_NAME },
  })
  let regionId: string | undefined = existingRegion?.id

  if (!regionId) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [{ name: REGION_NAME, currency_code: "usd", countries: ["us"] }],
      },
    })
    regionId = result[0].id
  }

  const { result: order } = await createOrderWorkflow(container).run({
    input: {
      region_id: regionId,
      email,
      shipping_address: {
        first_name: "Maria",
        last_name: "Perez",
        phone: "+1 555 0100",
        address_1: "1 Main St",
        city: "Springfield",
        postal_code: "12345",
        country_code: "us",
      },
      items: [{ title: "E2E Shirt", quantity: ITEM_QUANTITY, unit_price: 20 }],
    },
  })

  if (state === "canceled") {
    await cancelOrderWorkflow(container).run({
      input: { order_id: order.id },
    })
  }

  if (state === "fulfilled" || state === "delivered") {
    await addFulfillment(container, order.id, state === "delivered")
  }

  console.log(`${ORDER_ID_MARKER}${order.id}`)
}

// What core's create-fulfillment (and mark-as-delivered) flows leave behind: a
// shipped (or delivered) fulfillment for the order's item, linked to the order.
const addFulfillment = async (
  container: ExecArgs["container"],
  orderId: string,
  delivered: boolean
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "items.id"],
    filters: { id: orderId },
  })
  const [item] = order.items!
  const quantity = ITEM_QUANTITY

  const {
    data: [existingLocation],
  } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
    filters: { name: LOCATION_NAME },
  })
  let locationId: string | undefined = existingLocation?.id

  if (!locationId) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: { locations: [{ name: LOCATION_NAME }] },
    })
    locationId = result[0].id
  }

  const fulfillment = await container
    .resolve(Modules.FULFILLMENT)
    .createFulfillment({
      location_id: locationId,
      provider_id: "manual_manual",
      shipped_at: new Date(),
      delivered_at: delivered ? new Date() : null,
      delivery_address: {},
      items: [
        {
          title: "E2E Shirt",
          sku: "E2E-SHIRT",
          quantity,
          barcode: "",
          line_item_id: item!.id,
        },
      ],
      labels: [],
    })

  await container.resolve(ContainerRegistrationKeys.LINK).create({
    [Modules.ORDER]: { order_id: orderId },
    [Modules.FULFILLMENT]: { fulfillment_id: fulfillment.id },
  })

  await container.resolve(Modules.ORDER).registerFulfillment({
    order_id: orderId,
    reference: Modules.FULFILLMENT,
    reference_id: fulfillment.id,
    items: [{ id: item!.id, quantity }],
  })
}
