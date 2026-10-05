import { z } from "@medusajs/framework/zod"

// `keys=a,b` or `keys=a&keys=b`: trimmed, blanks dropped, duplicates removed.
// A key that doesn't exist is answered with null, never rejected.
export const StoreGetProductMetafieldsParams = z.strictObject({
  keys: z
    .union([z.string(), z.array(z.string())])
    .transform((keys) => [
      ...new Set(
        (Array.isArray(keys) ? keys : [keys])
          .flatMap((key) => key.split(","))
          .map((key) => key.trim())
          .filter(Boolean)
      ),
    ])
    .refine((keys) => keys.length > 0, {
      message: "Send at least one metafield key",
    }),
})

export type StoreGetProductMetafieldsParamsType = z.infer<
  typeof StoreGetProductMetafieldsParams
>
