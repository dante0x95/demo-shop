import { collectPages } from "./collect-pages"
import { listBrands } from "./brands"
import { sdk } from "./sdk"

// Mirrors the body of `POST /admin/products/full` (T08): core product fields,
// images as media library ids, stock per location on each variant and the
// brand through `additional_data`.
export type AdminProductFullStock = {
  location_id: string
  quantity: number
}

export type AdminProductFullVariant = {
  title: string
  sku?: string
  barcode?: string
  manage_inventory: boolean
  options: Record<string, string>
  prices: { currency_code: string; amount: number }[]
  stock?: AdminProductFullStock[]
}

export type AdminCreateProductFullPayload = {
  title: string
  description?: string
  handle?: string
  status: "draft" | "published"
  images?: string[]
  thumbnail_id?: string
  categories?: { id: string }[]
  tags?: { id: string }[]
  sales_channels?: { id: string }[]
  type_id?: string
  collection_id?: string
  shipping_profile_id?: string
  weight?: number
  length?: number
  width?: number
  height?: number
  origin_country?: string
  hs_code?: string
  options: { title: string; values: string[] }[]
  variants: AdminProductFullVariant[]
  additional_data?: { brand_id: string }
}

export type AdminCreatedProductFull = {
  id: string
  title: string
  variants:
    | {
        id: string
        title: string
        options: { value: string; option: { title: string } | null }[] | null
      }[]
    | null
}

export const createProductFull = (body: AdminCreateProductFullPayload) =>
  sdk.client.fetch<{ product: AdminCreatedProductFull }>(
    "/admin/products/full",
    {
      method: "POST",
      body,
      // What the page needs to save the other parts; option values identify
      // each variant.
      query: {
        fields:
          "id,title,variants.id,variants.title,variants.options.value,variants.options.option.title",
      },
    }
  )

// A choice in one of the page's pickers.
export type PickerOption = {
  value: string
  label: string
}

const PAGE_SIZE = 100

// Every record of a core list, page by page, as picker options. Shops keep a
// handful of each, but no option is ever left out.
const allOptions = <T>(
  fetchPage: (
    offset: number,
    limit: number
  ) => Promise<{ items: T[]; count: number }>,
  toOption: (item: T) => PickerOption
) => collectPages(fetchPage, PAGE_SIZE).then((items) => items.map(toOption))

export const listCategoryOptions = () =>
  allOptions(
    async (offset, limit) => {
      const page = await sdk.admin.productCategory.list({
        offset,
        limit,
        order: "name",
        fields: "id,name",
      })
      return { items: page.product_categories, count: page.count }
    },
    (category) => ({ value: category.id, label: category.name })
  )

export const listTagOptions = () =>
  allOptions(
    async (offset, limit) => {
      const page = await sdk.admin.productTag.list({
        offset,
        limit,
        order: "value",
        fields: "id,value",
      })
      return { items: page.product_tags, count: page.count }
    },
    (tag) => ({ value: tag.id, label: tag.value })
  )

export const listTypeOptions = () =>
  allOptions(
    async (offset, limit) => {
      const page = await sdk.admin.productType.list({
        offset,
        limit,
        order: "value",
        fields: "id,value",
      })
      return { items: page.product_types, count: page.count }
    },
    (type) => ({ value: type.id, label: type.value })
  )

export const listCollectionOptions = () =>
  allOptions(
    async (offset, limit) => {
      const page = await sdk.admin.productCollection.list({
        offset,
        limit,
        order: "title",
        fields: "id,title",
      })
      return { items: page.collections, count: page.count }
    },
    (collection) => ({ value: collection.id, label: collection.title })
  )

export const listSalesChannelOptions = () =>
  allOptions(
    async (offset, limit) => {
      const page = await sdk.admin.salesChannel.list({
        offset,
        limit,
        order: "name",
        fields: "id,name",
      })
      return { items: page.sales_channels, count: page.count }
    },
    (channel) => ({ value: channel.id, label: channel.name })
  )

export const listShippingProfileOptions = () =>
  allOptions(
    async (offset, limit) => {
      const page = await sdk.admin.shippingProfile.list({
        offset,
        limit,
        order: "name",
        fields: "id,name",
      })
      return { items: page.shipping_profiles, count: page.count }
    },
    (profile) => ({ value: profile.id, label: profile.name })
  )

export const listStockLocationOptions = () =>
  allOptions(
    async (offset, limit) => {
      const page = await sdk.admin.stockLocation.list({
        offset,
        limit,
        order: "name",
        fields: "id,name",
      })
      return { items: page.stock_locations, count: page.count }
    },
    (location) => ({ value: location.id, label: location.name })
  )

export const listBrandOptions = () =>
  allOptions(
    async (offset, limit) => {
      const page = await listBrands({ offset, limit, order: "name" })
      return { items: page.brands, count: page.count }
    },
    (brand) => ({ value: brand.id, label: brand.name })
  )

// What the page needs from the store: its default currency (prices are
// created in it, like T21's amounts) and its default sales channel.
export const retrieveStoreDefaults = async () => {
  const { stores } = await sdk.admin.store.list({
    fields: "id,default_sales_channel_id,*supported_currencies",
  })
  const [store] = stores

  return {
    supported_currencies: store?.supported_currencies ?? [],
    default_sales_channel_id: store?.default_sales_channel_id ?? null,
  }
}

export const addProductQueryKeys = {
  categories: ["product_categories", "add_product_options"] as const,
  tags: ["product_tags", "add_product_options"] as const,
  types: ["product_types", "add_product_options"] as const,
  collections: ["collections", "add_product_options"] as const,
  salesChannels: ["sales_channels", "add_product_options"] as const,
  shippingProfiles: ["shipping_profiles", "add_product_options"] as const,
  stockLocations: ["stock_locations", "add_product_options"] as const,
  brands: ["brands", "add_product_options"] as const,
  store: ["store", "add_product_defaults"] as const,
}
