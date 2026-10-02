import { z } from "@medusajs/framework/zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

export const StoreGetBrandsParams = z.strictObject({
  ...createFindParams({ limit: 20, offset: 0, order: "name" }).shape,
  q: z.string().trim().min(1).optional(),
  handle: z.string().trim().min(1).optional(),
})

export type StoreGetBrandsParamsType = z.infer<typeof StoreGetBrandsParams>
