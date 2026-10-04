import { z } from "@medusajs/framework/zod"

// Whether a value fits its key (type, select options, an existing definition
// or value) is checked in the set-product-metafields workflow.
export const AdminSetProductMetafields = z.strictObject({
  metafields: z
    .array(
      z.strictObject({
        key: z.string().min(1),
        value: z.union([z.string(), z.number(), z.boolean()]),
      })
    )
    .min(1)
    .refine(
      (metafields) =>
        new Set(metafields.map((metafield) => metafield.key)).size ===
        metafields.length,
      { message: "Each metafield key can only be sent once" }
    ),
})

export type AdminSetProductMetafieldsType = z.infer<
  typeof AdminSetProductMetafields
>
