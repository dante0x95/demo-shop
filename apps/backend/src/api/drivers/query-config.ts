export const defaultDriverFields = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "vehicle_type",
  "license_plate",
  "is_active",
  "metadata",
  "created_at",
  "updated_at",
]

export const retrieveDriverTransformQueryConfig = {
  defaults: defaultDriverFields,
  isList: false,
}

// What a driver needs to deliver an order and collect cash on delivery. The
// list is also the allow-list: other fields (customer, payments, the driver
// relation, ...) are dropped from `fields`, and ordering by them is a 400.
export const defaultDriverOrderFields = [
  "id",
  "display_id",
  "status",
  "email",
  "currency_code",
  "total",
  "created_at",
  "updated_at",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.phone",
  "shipping_address.company",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.country_code",
  "items.id",
  "items.title",
  "items.variant_title",
  "items.thumbnail",
  "items.quantity",
  "fulfillments.id",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
]

export const listDriverOrdersTransformQueryConfig = {
  defaults: defaultDriverOrderFields,
  allowed: defaultDriverOrderFields,
  defaultLimit: 20,
  isList: true,
}
