import type { MetafieldType } from "../../modules/metafield/models/metafield-definition"
import type { MetafieldValueData } from "../../modules/metafield/utils/values"
import { sdk } from "./sdk"

export type { MetafieldType, MetafieldValueData }

export type AdminMetafieldDefinition = {
  id: string
  key: string
  label: string
  type: MetafieldType
  // A select's options; null for every other type.
  options: string[] | null
  owner_type: string
  storefront_access: boolean
  created_at: string
  updated_at: string
}

export type AdminMetafieldDefinitionListResponse = {
  metafield_definitions: AdminMetafieldDefinition[]
  count: number
  offset: number
  limit: number
}

export type AdminMetafieldDefinitionResponse = {
  metafield_definition: AdminMetafieldDefinition
}

export type AdminMetafieldDefinitionListParams = {
  limit: number
  offset: number
  owner_type: string
  order?: string
}

export type AdminCreateMetafieldDefinitionPayload = {
  key: string
  label: string
  type?: MetafieldType
  options?: string[]
  owner_type: string
}

// A key with values but no definition (its definition was deleted).
export type AdminUnstructuredMetafield = {
  owner_type: string
  key: string
  type: MetafieldType
  values_count: number
}

export type AdminUnstructuredMetafieldListResponse = {
  unstructured_metafields: AdminUnstructuredMetafield[]
  count: number
  offset: number
  limit: number
}

export type AdminPaginationParams = {
  limit: number
  offset: number
}

// A product's value; `definition` is null for an unstructured value.
export type AdminProductMetafield = {
  id: string
  key: string
  type: MetafieldType
  value: MetafieldValueData
  definition: {
    id: string
    label: string
    type: MetafieldType
    options: string[] | null
    storefront_access: boolean
  } | null
  created_at: string
  updated_at: string
}

export type AdminMetafieldConfig = {
  owner_types: string[]
}

// The owner type of the product endpoints (`/admin/products/:id/metafields`).
export const PRODUCT_OWNER_TYPE = "product"

export const metafieldQueryKeys = {
  // Definitions and unstructured keys change together (deleting a definition
  // can leave its values unstructured), so both live under `all`.
  all: ["metafields"] as const,
  definitionList: (params: AdminMetafieldDefinitionListParams) =>
    ["metafields", "definitions", "list", params] as const,
  allDefinitions: (ownerType: string) =>
    ["metafields", "definitions", "all", ownerType] as const,
  unstructuredList: (ownerType: string, params: AdminPaginationParams) =>
    ["metafields", "unstructured", ownerType, params] as const,
  product: (productId: string) =>
    ["metafields", "product", productId] as const,
  // Outside `all`, so edits don't refetch it.
  config: ["metafield_config"] as const,
}

export const getMetafieldConfig = () =>
  sdk.client.fetch<{ config: AdminMetafieldConfig }>("/admin/metafields/config")

export const listMetafieldDefinitions = (
  params: AdminMetafieldDefinitionListParams
) =>
  sdk.client.fetch<AdminMetafieldDefinitionListResponse>(
    "/admin/metafield-definitions",
    { query: params }
  )

const ALL_DEFINITIONS_PAGE_SIZE = 100

// Every definition of an owner type, page by page.
export const listAllMetafieldDefinitions = async (ownerType: string) => {
  const definitions: AdminMetafieldDefinition[] = []

  for (;;) {
    const page = await listMetafieldDefinitions({
      owner_type: ownerType,
      limit: ALL_DEFINITIONS_PAGE_SIZE,
      offset: definitions.length,
      order: "created_at",
    })

    definitions.push(...page.metafield_definitions)

    if (
      !page.metafield_definitions.length ||
      definitions.length >= page.count
    ) {
      return definitions
    }
  }
}

export const createMetafieldDefinition = (
  body: AdminCreateMetafieldDefinitionPayload
) =>
  sdk.client.fetch<AdminMetafieldDefinitionResponse>(
    "/admin/metafield-definitions",
    { method: "POST", body }
  )

export const updateMetafieldDefinitionStorefrontAccess = (
  id: string,
  storefront_access: boolean
) =>
  sdk.client.fetch<AdminMetafieldDefinitionResponse>(
    `/admin/metafield-definitions/${id}`,
    { method: "POST", body: { storefront_access } }
  )

export const deleteMetafieldDefinition = (id: string, deleteValues: boolean) =>
  sdk.client.fetch<{
    id: string
    object: "metafield_definition"
    deleted: boolean
  }>(`/admin/metafield-definitions/${id}`, {
    method: "DELETE",
    query: deleteValues ? { delete_values: true } : undefined,
  })

export const listUnstructuredMetafields = (
  ownerType: string,
  params: AdminPaginationParams
) =>
  sdk.client.fetch<AdminUnstructuredMetafieldListResponse>(
    `/admin/metafields/unstructured/${encodeURIComponent(ownerType)}`,
    { query: params }
  )

export const deleteUnstructuredMetafieldValues = (
  ownerType: string,
  key: string
) =>
  sdk.client.fetch<{ values_deleted: number }>(
    `/admin/metafields/unstructured/${encodeURIComponent(ownerType)}/${encodeURIComponent(key)}`,
    { method: "DELETE" }
  )

export const listProductMetafields = (productId: string) =>
  sdk.client.fetch<{ metafields: AdminProductMetafield[] }>(
    `/admin/products/${productId}/metafields`
  )

export const setProductMetafields = (
  productId: string,
  metafields: { key: string; value: MetafieldValueData }[]
) =>
  sdk.client.fetch<{ metafields: AdminProductMetafield[] }>(
    `/admin/products/${productId}/metafields`,
    { method: "POST", body: { metafields } }
  )

export const deleteProductMetafield = (productId: string, key: string) =>
  sdk.client.fetch<{ key: string; deleted: boolean }>(
    `/admin/products/${productId}/metafields/${encodeURIComponent(key)}`,
    { method: "DELETE" }
  )
