import { model } from "@medusajs/framework/utils"

// A variant's compare-at price and cost per item, both amounts in the store's
// default currency (the store is single-currency). A row only exists once the
// admin sets one of them; null means "not set".
//
// There is deliberately no module link to the variant: a link would let
// `/store` requests reach the cost through `fields`. Routes read the rows by
// `variant_id` instead, and `/store` only gets the compare-at price, through
// the store middleware (see utils/variant-pricing.ts for when it is shown).
const VariantPriceDetail = model
  .define("variant_price_detail", {
    id: model.id({ prefix: "vprc" }).primaryKey(),
    variant_id: model.text(),
    compare_at_amount: model.bigNumber().nullable(),
    cost_amount: model.bigNumber().nullable(),
  })
  .indexes([
    {
      // One row per variant, also under concurrent first edits.
      on: ["variant_id"],
      unique: true,
    },
  ])

export default VariantPriceDetail
