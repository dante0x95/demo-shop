import { z } from "@medusajs/framework/zod"
import {
  createFindParams,
  createSelectParams,
} from "@medusajs/medusa/api/utils/validators"

export const AdminGetBrandParams = createSelectParams()

export type AdminGetBrandParamsType = z.infer<typeof AdminGetBrandParams>

export const AdminGetBrandsParams = createFindParams({
  limit: 20,
  offset: 0,
})

export type AdminGetBrandsParamsType = z.infer<typeof AdminGetBrandsParams>

export const AdminCreateBrand = z.strictObject({
  name: z.string().trim().min(1),
  handle: z.string().trim().min(1).optional(),
  description: z.string().nullish(),
  logo_url: z.url().nullish(),
  banner_url: z.url().nullish(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})

export type AdminCreateBrandType = z.infer<typeof AdminCreateBrand>
