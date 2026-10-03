import { z } from "@medusajs/framework/zod"

// No length limits (decided): 70 / 160 are only a counter in the admin UI.
// Empty or whitespace-only clears the field; so does null.
const seoValue = z.string().nullable().optional()

export const AdminUpdateProductSeo = z
  .strictObject({
    title: seoValue,
    description: seoValue,
  })
  .refine(
    (body) => body.title !== undefined || body.description !== undefined,
    { message: "Send title, description or both" }
  )

export type AdminUpdateProductSeoType = z.infer<typeof AdminUpdateProductSeo>
