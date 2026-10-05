import { z } from "@medusajs/framework/zod"
import { booleanString } from "@medusajs/medusa/api/utils/common-validators/index"
import {
  createFindParams,
  createSelectParams,
} from "@medusajs/medusa/api/utils/validators"
import { METAFIELD_TYPES } from "../../../modules/metafield/models/metafield-definition"

export const AdminGetMetafieldDefinitionParams = createSelectParams()

export type AdminGetMetafieldDefinitionParamsType = z.infer<
  typeof AdminGetMetafieldDefinitionParams
>

// `with_deleted` is left out: a deleted definition no longer applies.
export const AdminGetMetafieldDefinitionsParams = z.strictObject({
  ...createFindParams({ limit: 20, offset: 0, order: "-created_at" }).omit({
    with_deleted: true,
  }).shape,
  owner_type: z.string().trim().min(1).optional(),
})

export type AdminGetMetafieldDefinitionsParamsType = z.infer<
  typeof AdminGetMetafieldDefinitionsParams
>

// Rules that depend on module options or on the type (allowed owner types,
// select options) are checked in the create workflow.
export const AdminCreateMetafieldDefinition = z.strictObject({
  key: z
    .string()
    .regex(
      /^[a-z][a-z0-9_]{0,63}$/,
      "Key must be snake_case: a lowercase letter followed by up to 63 lowercase letters, digits or underscores"
    ),
  label: z.string().trim().min(1).max(255),
  type: z.enum(METAFIELD_TYPES),
  options: z.array(z.string().trim().min(1)).nullish(),
  owner_type: z.string().trim().min(1),
})

export type AdminCreateMetafieldDefinitionType = z.infer<
  typeof AdminCreateMetafieldDefinition
>

// Only the storefront access flag can change (decided).
export const AdminUpdateMetafieldDefinition = z.strictObject({
  storefront_access: z.boolean(),
})

export type AdminUpdateMetafieldDefinitionType = z.infer<
  typeof AdminUpdateMetafieldDefinition
>

// `delete_values=true` also deletes the definition's values; by default
// they are kept as unstructured values.
export const AdminDeleteMetafieldDefinitionParams = z.strictObject({
  delete_values: booleanString().optional(),
})

export type AdminDeleteMetafieldDefinitionParamsType = z.infer<
  typeof AdminDeleteMetafieldDefinitionParams
>
