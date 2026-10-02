import { z } from "@medusajs/framework/zod"
import { createSelectParams } from "@medusajs/medusa/api/utils/validators"

export const AdminGetOrderDriverParams = createSelectParams()

export type AdminGetOrderDriverParamsType = z.infer<
  typeof AdminGetOrderDriverParams
>

export const AdminAssignDriver = z.strictObject({
  driver_id: z.string().trim().min(1),
})

export type AdminAssignDriverType = z.infer<typeof AdminAssignDriver>
