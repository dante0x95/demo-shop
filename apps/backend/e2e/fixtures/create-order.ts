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
const STATES = [
  "pending",
  "canceled",
  "completed",
  "fulfilled",
  "delivered",
  "partially_delivered",
  "delivered_with_canceled",
] as const
// One unit per item, each item in its own fulfillment.
const ITEM_QUANTITY = 1

type OrderState = (typeof STATES)[number]

const ITEMS = ["E2E Shirt", "E2E Socks"]
const itemCount = (state: OrderState) =>
  state === "partially_delivered" || state === "delivered_with_canceled"
    ? 2
    : 1

// Creates an order for E2E specs; storefront checkout isn't part of them.
// Prints the new order's id after ORDER_ID_MARKER, for the spec to read.
// Usage: npx medusa exec ./e2e/fixtures/create-order.ts <email> [state]
//   state: pending (default) | canceled | completed | fulfilled | delivered |
//          partially_delivered | delivered_with_canceled
//   completed: the order is completed (a status that takes no driver).
//   fulfilled: the order has a shipped fulfillment, not delivered yet.
//   delivered: the order has a fulfillment with `delivered_at` set, as left by
//   a driver confirming the delivery.
//   partially_delivered: two items in two fulfillments, only one delivered.
//   delivered_with_canceled: a delivered fulfillment plus a second, canceled
//   one (which doesn't count towards the delivery).
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
      items: ITEMS.slice(0, itemCount(state as OrderState)).map((title) => ({
        title,
        quantity: ITEM_QUANTITY,
        unit_price: 20,
      })),
    },
  })

  if (state === "canceled") {
    await cancelOrderWorkflow(container).run({
      input: { order_id: order.id },
    })
  }

  if (state === "completed") {
    await container.resolve(Modules.ORDER).completeOrder([order.id])
  }

  if (state === "fulfilled" || state === "delivered") {
    await addFulfillment(container, order.id, ITEMS[0], {
      delivered: state === "delivered",
    })
  }

  if (state === "partially_delivered") {
    await addFulfillment(container, order.id, ITEMS[0], { delivered: true })
    await addFulfillment(container, order.id, ITEMS[1], { delivered: false })
  }

  if (state === "delivered_with_canceled") {
    await addFulfillment(container, order.id, ITEMS[0], { delivered: true })
    await addFulfillment(container, order.id, ITEMS[1], {
      delivered: false,
      canceled: true,
    })
  }

  console.log(`${ORDER_ID_MARKER}${order.id}`)
}

// What core's create-fulfillment (and mark-as-delivered) flows leave behind: a
// shipped (or delivered) fulfillment for the order's item, linked to the order.
const addFulfillment = async (
  container: ExecArgs["container"],
  orderId: string,
  itemTitle: string,
  { delivered, canceled = false }: { delivered: boolean; canceled?: boolean }
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "items.id", "items.title"],
    filters: { id: orderId },
  })
  const item = order.items!.find((i) => i!.title === itemTitle)!
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
      canceled_at: canceled ? new Date() : null,
      delivery_address: {},
      items: [
        {
          title: itemTitle,
          sku: itemTitle.toUpperCase().replace(/ /g, "-"),
          quantity,
          barcode: "",
          line_item_id: item.id,
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
    items: [{ id: item.id, quantity }],
  })
}
