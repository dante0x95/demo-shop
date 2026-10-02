import { z } from "@medusajs/framework/zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

// `with_deleted` is admin-only: a public caller must never see soft-deleted brands.
export const StoreGetBrandsParams = z.strictObject({
  ...createFindParams({ limit: 20, offset: 0, order: "name" }).omit({
    with_deleted: true,
  }).shape,
  q: z.string().trim().min(1).optional(),
  handle: z.string().trim().min(1).optional(),
})

export type StoreGetBrandsParamsType = z.infer<typeof StoreGetBrandsParams>
