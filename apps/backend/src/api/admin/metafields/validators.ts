import { z } from "@medusajs/framework/zod"
import { createFindParams } from "@medusajs/medusa/api/utils/validators"

// Keys are always ordered by key, and the rows are computed, so only
// pagination applies.
export const AdminGetUnstructuredMetafieldsParams = z.strictObject({
  ...createFindParams({ limit: 20, offset: 0 }).pick({
    limit: true,
    offset: true,
  }).shape,
})

export type AdminGetUnstructuredMetafieldsParamsType = z.infer<
  typeof AdminGetUnstructuredMetafieldsParams
>
