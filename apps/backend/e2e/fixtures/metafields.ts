import { APIRequestContext, expect } from "@playwright/test"

export type Definition = {
  id: string
  key: string
  label: string
  type: "text" | "number" | "boolean" | "select"
  options: string[] | null
  storefront_access: boolean
}

export type ProductMetafield = {
  key: string
  type: Definition["type"]
  value: string | number | boolean
  definition: { id: string; label: string } | null
}

// Keys are unique per owner type and the E2E database is shared by every
// spec, so each test makes its own (snake_case, starting with a letter).
export const uniqueKey = (label: string) =>
  `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export const createDefinitionViaApi = async (
  request: APIRequestContext,
  data: Partial<Omit<Definition, "id" | "storefront_access">> & { key: string }
): Promise<Definition> => {
  const res = await request.post("/admin/metafield-definitions", {
    data: { label: data.key, type: "text", owner_type: "product", ...data },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).metafield_definition
}

export const deleteDefinitionViaApi = async (
  request: APIRequestContext,
  id: string,
  deleteValues = false
) => {
  const res = await request.delete(`/admin/metafield-definitions/${id}`, {
    params: deleteValues ? { delete_values: "true" } : {},
  })
  expect(res.status()).toBe(200)
}

export const createProductViaApi = async (
  request: APIRequestContext,
  title: string
): Promise<{ id: string; title: string }> => {
  const res = await request.post("/admin/products", {
    data: { title, options: [{ title: "Size", values: ["M"] }] },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).product
}

export const setProductMetafieldsViaApi = async (
  request: APIRequestContext,
  productId: string,
  metafields: { key: string; value: string | number | boolean }[]
) => {
  const res = await request.post(`/admin/products/${productId}/metafields`, {
    data: { metafields },
  })
  expect(res.status()).toBe(200)
}

export const listProductMetafieldsViaApi = async (
  request: APIRequestContext,
  productId: string
): Promise<ProductMetafield[]> => {
  const res = await request.get(`/admin/products/${productId}/metafields`)
  expect(res.status()).toBe(200)
  return (await res.json()).metafields
}

// The unstructured list is paginated by key, so tests that look for a key in
// it start from an empty list.
export const deleteAllUnstructuredViaApi = async (
  request: APIRequestContext
) => {
  for (;;) {
    const res = await request.get("/admin/metafields/unstructured/product", {
      params: { limit: 100 },
    })
    expect(res.status()).toBe(200)
    const { unstructured_metafields } = await res.json()

    if (!unstructured_metafields.length) {
      return
    }

    for (const { key } of unstructured_metafields as { key: string }[]) {
      const deleted = await request.delete(
        `/admin/metafields/unstructured/product/${key}`
      )
      expect(deleted.status()).toBe(200)
    }
  }
}
