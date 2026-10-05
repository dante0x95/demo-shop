import {
  AdminDeleteMetafieldDefinitionParams,
  AdminUpdateMetafieldDefinition,
} from "../admin/metafield-definitions/validators"
import { AdminGetUnstructuredMetafieldsParams } from "../admin/metafields/validators"
import { AdminSetProductMetafields } from "../admin/products/[id]/metafields/validators"
import { StoreGetProductMetafieldsParams } from "../store/products/[id]/metafields/validators"

describe("StoreGetProductMetafieldsParams", () => {
  it("splits a comma-separated list, trimming and dropping blanks", () => {
    expect(
      StoreGetProductMetafieldsParams.parse({ keys: " fabric, ,care ," })
    ).toEqual({ keys: ["fabric", "care"] })
  })

  it("accepts repeated params and removes duplicates", () => {
    expect(
      StoreGetProductMetafieldsParams.parse({
        keys: ["fabric", "care,fabric", "care"],
      })
    ).toEqual({ keys: ["fabric", "care"] })
  })

  it("keeps keys that could never exist, so they come back as null", () => {
    expect(
      StoreGetProductMetafieldsParams.parse({ keys: "Not-A-Key" })
    ).toEqual({ keys: ["Not-A-Key"] })
  })

  it.each([[{}], [{ keys: "" }], [{ keys: " , " }], [{ keys: [] }]])(
    "rejects %p without any key",
    (query) => {
      expect(StoreGetProductMetafieldsParams.safeParse(query).success).toBe(
        false
      )
    }
  )

  it("rejects unknown params", () => {
    expect(
      StoreGetProductMetafieldsParams.safeParse({ keys: "a", fields: "id" })
        .success
    ).toBe(false)
  })
})

describe("AdminSetProductMetafields", () => {
  it("accepts text, number and boolean values", () => {
    const body = {
      metafields: [
        { key: "fabric", value: "Cotton" },
        { key: "weight", value: 1.5 },
        { key: "organic", value: false },
      ],
    }

    expect(AdminSetProductMetafields.parse(body)).toEqual(body)
  })

  it.each([
    ["an empty list", { metafields: [] }],
    ["a missing list", {}],
    ["a null value", { metafields: [{ key: "fabric", value: null }] }],
    ["an object value", { metafields: [{ key: "fabric", value: {} }] }],
    ["an empty key", { metafields: [{ key: "", value: "x" }] }],
    ["an unknown field", { metafields: [{ key: "a", value: "x", type: "text" }] }],
    [
      "the same key twice",
      {
        metafields: [
          { key: "fabric", value: "Cotton" },
          { key: "fabric", value: "Wool" },
        ],
      },
    ],
  ])("rejects %s", (_, body) => {
    expect(AdminSetProductMetafields.safeParse(body).success).toBe(false)
  })
})

describe("AdminUpdateMetafieldDefinition", () => {
  it("accepts the storefront access flag", () => {
    expect(
      AdminUpdateMetafieldDefinition.parse({ storefront_access: true })
    ).toEqual({ storefront_access: true })
  })

  it.each([
    ["no flag", {}],
    ["a string flag", { storefront_access: "true" }],
    ["another field", { storefront_access: true, label: "Fabric" }],
  ])("rejects %s", (_, body) => {
    expect(AdminUpdateMetafieldDefinition.safeParse(body).success).toBe(false)
  })
})

describe("AdminDeleteMetafieldDefinitionParams", () => {
  it.each([
    [{}, undefined],
    [{ delete_values: "true" }, true],
    [{ delete_values: "TRUE" }, true],
    [{ delete_values: "false" }, false],
  ])("reads %p as delete_values %p", (query, expected) => {
    expect(
      AdminDeleteMetafieldDefinitionParams.parse(query).delete_values
    ).toBe(expected)
  })

  it.each([[{ delete_values: "yes" }], [{ force: "true" }]])(
    "rejects %p",
    (query) => {
      expect(
        AdminDeleteMetafieldDefinitionParams.safeParse(query).success
      ).toBe(false)
    }
  )
})

describe("AdminGetUnstructuredMetafieldsParams", () => {
  it("defaults to the first 20 keys", () => {
    expect(AdminGetUnstructuredMetafieldsParams.parse({})).toEqual({
      limit: 20,
      offset: 0,
    })
  })

  it("rejects ordering, which is always by key", () => {
    expect(
      AdminGetUnstructuredMetafieldsParams.safeParse({ order: "-key" }).success
    ).toBe(false)
  })
})
