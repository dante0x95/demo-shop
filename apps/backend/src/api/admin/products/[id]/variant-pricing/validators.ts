import { z } from "@medusajs/framework/zod"

// An amount in the store's default currency, stored as sent (49.99 = 49.99).
// Any non-negative value is saved: there is no "compare-at must be higher"
// check (the storefront just doesn't show a lower one). null clears it.
const amount = z.number().finite().nonnegative().nullable().optional()

const AdminVariantPricingItem = z
  .strictObject({
    variant_id: z.string().min(1),
    compare_at_amount: amount,
    cost_amount: amount,
  })
  .refine(
    (item) =>
      item.compare_at_amount !== undefined || item.cost_amount !== undefined,
    { message: "Send compare_at_amount, cost_amount or both" }
  )

export const AdminUpdateVariantPricing = z.strictObject({
  variants: z
    .array(AdminVariantPricingItem)
    .min(1)
    .refine(
      (variants) =>
        new Set(variants.map((variant) => variant.variant_id)).size ===
        variants.length,
      { message: "Each variant can only be sent once" }
    ),
})

export type AdminUpdateVariantPricingType = z.infer<
  typeof AdminUpdateVariantPricing
>
