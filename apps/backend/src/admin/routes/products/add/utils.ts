// The "Add product" form's rules: which variants the options make, what
// `POST /admin/products/full` receives, and what the T20-T23 endpoints
// receive once the product exists. Type-only imports from the SDK client, so
// unit tests can load this file.
import type {
  AdminCreateProductFullPayload,
  AdminProductFullVariant,
} from "../../../lib/add-product"
import type {
  AdminMetafieldDefinition,
  MetafieldValueData,
} from "../../../lib/metafields"
import type { AdminUpdateProductSeoPayload } from "../../../lib/product-seo"
import type { AdminUpdateVariantPricingItem } from "../../../lib/variant-pricing"
import {
  buildProductMetafieldChanges,
  buildProductMetafieldFields,
} from "../../../lib/metafield-form"
import {
  AMOUNT_ERROR,
  parseAmountInput,
} from "../../../components/variant-pricing/utils"
import { normalizeSeoValue } from "../../../../modules/seo/utils/product-seo"

export { AMOUNT_ERROR, parseAmountInput }

// What Medusa's own product form creates for a product without options: one
// option with one value, and one variant.
export const DEFAULT_OPTION_TITLE = "Default option"
export const DEFAULT_OPTION_VALUE = "Default option value"
export const DEFAULT_VARIANT_TITLE = "Default variant"
// Key of the default variant's inputs. Combination keys are JSON arrays, so
// they never collide with it.
export const DEFAULT_VARIANT_KEY = "default"

export const QUANTITY_ERROR = "Enter a whole number of 0 or more"
export const MEASURE_ERROR = "Enter a number of 0 or more, like 1.5"
export const TITLE_ERROR = "Enter a title"
export const OPTION_TITLE_ERROR = "Name the option"
export const OPTION_VALUES_ERROR = "Add at least one value, separated by commas"
export const OPTION_DUPLICATE_ERROR = "Another option has this name"
export const NO_CURRENCY_ERROR =
  "The store has no default currency, so prices can't be set"

export type ProductStatus = "draft" | "published"

export type OptionFormRow = {
  // Stable id for React and error keys; never sent.
  key: string
  title: string
  // Values separated by commas, as typed.
  values: string
}

// What the admin types for one variant. Empty means "not set".
export type VariantFormRow = {
  price: string
  compare_at_amount: string
  cost_amount: string
  sku: string
  barcode: string
  // Quantity per stock location id.
  stock: Record<string, string>
}

export type ShippingForm = {
  package_preset_id: string | null
  shipping_profile_id: string
  weight: string
  length: string
  width: string
  height: string
  origin_country: string
  hs_code: string
}

export type AddProductForm = {
  title: string
  description: string
  handle: string
  status: ProductStatus
  // Media library ids, in display order.
  media_ids: string[]
  thumbnail_id: string | null
  category_ids: string[]
  tag_ids: string[]
  sales_channel_ids: string[]
  type_id: string
  collection_id: string
  brand_id: string
  track_inventory: boolean
  options: OptionFormRow[]
  // Inputs per variant key (see `buildVariantCombinations`).
  variants: Record<string, VariantFormRow>
  shipping: ShippingForm
  // Metafield inputs per definition key, as `metafield-form` reads them.
  metafields: Record<string, string>
  seo: { title: string; description: string }
}

export const emptyVariantRow = (): VariantFormRow => ({
  price: "",
  compare_at_amount: "",
  cost_amount: "",
  sku: "",
  barcode: "",
  stock: {},
})

export const emptyAddProductForm = (
  defaults: { sales_channel_ids?: string[] } = {}
): AddProductForm => ({
  title: "",
  description: "",
  handle: "",
  status: "draft",
  media_ids: [],
  thumbnail_id: null,
  category_ids: [],
  tag_ids: [],
  sales_channel_ids: defaults.sales_channel_ids ?? [],
  type_id: "",
  collection_id: "",
  brand_id: "",
  track_inventory: true,
  options: [],
  variants: {},
  shipping: {
    package_preset_id: null,
    shipping_profile_id: "",
    weight: "",
    length: "",
    width: "",
    height: "",
    origin_country: "",
    hs_code: "",
  },
  metafields: {},
  seo: { title: "", description: "" },
})

// "S, M ,, L, M" -> ["S", "M", "L"]: trimmed, blanks and repeats dropped.
export const parseOptionValues = (text: string): string[] => [
  ...new Set(
    text
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  ),
]

export type VariantCombination = {
  key: string
  title: string
  // Option title -> value, as the API expects.
  options: Record<string, string>
}

// Options that make variants: named and with at least one value. Others are
// still being typed (and are reported when the form is saved).
const usableOptions = (options: OptionFormRow[]) =>
  options
    .map((option) => ({
      title: option.title.trim(),
      values: parseOptionValues(option.values),
    }))
    .filter((option) => option.title && option.values.length)

// One variant per combination of the options' values, in the order typed
// (first option varies slowest), like Shopify. Without options, the single
// default variant.
export const buildVariantCombinations = (
  options: OptionFormRow[]
): VariantCombination[] => {
  const usable = usableOptions(options)

  if (!usable.length) {
    return [
      {
        key: DEFAULT_VARIANT_KEY,
        title: DEFAULT_VARIANT_TITLE,
        options: { [DEFAULT_OPTION_TITLE]: DEFAULT_OPTION_VALUE },
      },
    ]
  }

  let combinations: string[][] = [[]]

  for (const option of usable) {
    combinations = combinations.flatMap((combination) =>
      option.values.map((value) => [...combination, value])
    )
  }

  return combinations.map((values) => ({
    key: JSON.stringify(values),
    title: values.join(" / "),
    options: Object.fromEntries(
      usable.map((option, index) => [option.title, values[index]])
    ),
  }))
}

export type AddProductContext = {
  // The store's default currency; prices are created in it.
  currency_code: string | null
  // The stock locations the form shows quantities for.
  location_ids: string[]
  metafield_definitions: Pick<
    AdminMetafieldDefinition,
    "key" | "label" | "type" | "options"
  >[]
}

// Error per field, keyed like "title", "options.<key>.values",
// "variants.<variant key>.price", "variants.<variant key>.stock.<location>",
// "shipping.weight" or "metafields.<key>".
export type AddProductErrors = Record<string, string>

const QUANTITY_PATTERN = /^\d+$/

// A stock quantity: null when empty (no stock sent for that location), or
// undefined when it is not a whole number of 0 or more.
export const parseQuantityInput = (
  input: string
): number | null | undefined => {
  const value = input.trim()

  if (!value) {
    return null
  }

  return QUANTITY_PATTERN.test(value) ? Number(value) : undefined
}

const optionErrors = (options: OptionFormRow[]): AddProductErrors => {
  const errors: AddProductErrors = {}
  const seen = new Set<string>()

  for (const option of options) {
    const title = option.title.trim()
    const hasValues = parseOptionValues(option.values).length > 0

    // An untouched row is ignored, like an option that was never added.
    if (!title && !hasValues) {
      continue
    }

    if (!title) {
      errors[`options.${option.key}.title`] = OPTION_TITLE_ERROR
    } else if (seen.has(title.toLowerCase())) {
      errors[`options.${option.key}.title`] = OPTION_DUPLICATE_ERROR
    } else {
      seen.add(title.toLowerCase())
    }

    if (!hasValues) {
      errors[`options.${option.key}.values`] = OPTION_VALUES_ERROR
    }
  }

  return errors
}

const metafieldFields = (ctx: AddProductContext) =>
  buildProductMetafieldFields(ctx.metafield_definitions, [])

// The metafield values to save, and an error per field that can't be saved.
const metafieldValues = (form: AddProductForm, ctx: AddProductContext) => {
  const values: { key: string; value: MetafieldValueData }[] = []
  const errors: AddProductErrors = {}

  for (const field of metafieldFields(ctx)) {
    const changes = buildProductMetafieldChanges([field], form.metafields)

    if (changes.errors.length) {
      errors[`metafields.${field.key}`] = changes.errors[0]
    }

    values.push(...changes.set)
  }

  return { values, errors }
}

const trimmed = (value: string) => value.trim() || undefined

export type BuildPayloadResult =
  | { payload: AdminCreateProductFullPayload; errors: null }
  | { payload: null; errors: AddProductErrors }

// Checks everything the page saves, including what is only saved after the
// product exists (compare-at, cost, metafields), so a typo never leaves a
// half-saved product. Returns the create request, or the errors to show.
export const buildCreateProductFullPayload = (
  form: AddProductForm,
  ctx: AddProductContext
): BuildPayloadResult => {
  const errors: AddProductErrors = {
    ...optionErrors(form.options),
    ...metafieldValues(form, ctx).errors,
  }

  const title = form.title.trim()

  if (!title) {
    errors.title = TITLE_ERROR
  }

  const variants: AdminProductFullVariant[] = []

  for (const combination of buildVariantCombinations(form.options)) {
    const row = form.variants[combination.key] ?? emptyVariantRow()
    const at = `variants.${combination.key}`

    const price = parseAmountInput(row.price)
    let prices: AdminProductFullVariant["prices"] = []

    if (price === undefined) {
      errors[`${at}.price`] = AMOUNT_ERROR
    } else if (price !== null) {
      if (ctx.currency_code) {
        prices = [{ currency_code: ctx.currency_code, amount: price }]
      } else {
        errors[`${at}.price`] = NO_CURRENCY_ERROR
      }
    }

    for (const field of ["compare_at_amount", "cost_amount"] as const) {
      if (parseAmountInput(row[field]) === undefined) {
        errors[`${at}.${field}`] = AMOUNT_ERROR
      }
    }

    const stock: { location_id: string; quantity: number }[] = []

    if (form.track_inventory) {
      for (const locationId of ctx.location_ids) {
        const quantity = parseQuantityInput(row.stock[locationId] ?? "")

        if (quantity === undefined) {
          errors[`${at}.stock.${locationId}`] = QUANTITY_ERROR
        } else if (quantity !== null) {
          stock.push({ location_id: locationId, quantity })
        }
      }
    }

    variants.push({
      title: combination.title,
      ...(trimmed(row.sku) ? { sku: trimmed(row.sku) } : {}),
      ...(trimmed(row.barcode) ? { barcode: trimmed(row.barcode) } : {}),
      manage_inventory: form.track_inventory,
      options: combination.options,
      prices,
      ...(stock.length ? { stock } : {}),
    })
  }

  const measures: Partial<
    Record<"weight" | "length" | "width" | "height", number>
  > = {}

  for (const field of ["weight", "length", "width", "height"] as const) {
    const value = parseAmountInput(form.shipping[field])

    if (value === undefined) {
      errors[`shipping.${field}`] = MEASURE_ERROR
    } else if (value !== null) {
      measures[field] = value
    }
  }

  if (Object.keys(errors).length) {
    return { payload: null, errors }
  }

  const usable = usableOptions(form.options)
  const thumbnailId =
    form.thumbnail_id && form.media_ids.includes(form.thumbnail_id)
      ? form.thumbnail_id
      : undefined

  const payload: AdminCreateProductFullPayload = {
    title,
    status: form.status,
    options: usable.length
      ? usable
      : [{ title: DEFAULT_OPTION_TITLE, values: [DEFAULT_OPTION_VALUE] }],
    variants,
    ...measures,
  }

  const description = trimmed(form.description)
  const handle = trimmed(form.handle)
  const hsCode = trimmed(form.shipping.hs_code)

  if (description) payload.description = description
  if (handle) payload.handle = handle
  if (form.media_ids.length) payload.images = [...form.media_ids]
  if (thumbnailId) payload.thumbnail_id = thumbnailId
  if (form.category_ids.length) {
    payload.categories = form.category_ids.map((id) => ({ id }))
  }
  if (form.tag_ids.length) payload.tags = form.tag_ids.map((id) => ({ id }))
  if (form.sales_channel_ids.length) {
    payload.sales_channels = form.sales_channel_ids.map((id) => ({ id }))
  }
  if (form.type_id) payload.type_id = form.type_id
  if (form.collection_id) payload.collection_id = form.collection_id
  if (form.shipping.shipping_profile_id) {
    payload.shipping_profile_id = form.shipping.shipping_profile_id
  }
  if (form.shipping.origin_country) {
    payload.origin_country = form.shipping.origin_country
  }
  if (hsCode) payload.hs_code = hsCode
  if (form.brand_id) payload.additional_data = { brand_id: form.brand_id }

  return { payload, errors: null }
}

// The parts saved after the product exists, each through its own endpoint.
export type FollowUpPart = "pricing" | "metafields" | "seo" | "package"

export const FOLLOW_UP_LABELS: Record<FollowUpPart, string> = {
  pricing: "Compare-at prices and costs",
  metafields: "Metafields",
  seo: "SEO",
  package: "Package",
}

export type FollowUpRequests = {
  pricing: AdminUpdateVariantPricingItem[] | null
  metafields: { key: string; value: MetafieldValueData }[] | null
  seo: AdminUpdateProductSeoPayload | null
  package: string | null
  // Variants with a compare-at or cost whose created variant wasn't found
  // (by title) in the API's response.
  unmatched_variants: string[]
}

// What to send to the T20-T23 endpoints for the created product. A part
// with nothing to save is null and isn't sent. Only for a form that
// `buildCreateProductFullPayload` accepted.
export const buildFollowUpRequests = (
  form: AddProductForm,
  ctx: AddProductContext,
  createdVariants: { id: string; title: string }[]
): FollowUpRequests => {
  const idByTitle = new Map(
    createdVariants.map((variant) => [variant.title, variant.id])
  )
  const pricing: AdminUpdateVariantPricingItem[] = []
  const unmatched: string[] = []

  for (const combination of buildVariantCombinations(form.options)) {
    const row = form.variants[combination.key]

    if (!row) {
      continue
    }

    const compareAt = parseAmountInput(row.compare_at_amount)
    const cost = parseAmountInput(row.cost_amount)
    const item: AdminUpdateVariantPricingItem = { variant_id: "" }

    if (compareAt != null) item.compare_at_amount = compareAt
    if (cost != null) item.cost_amount = cost

    if (Object.keys(item).length === 1) {
      continue
    }

    const variantId = idByTitle.get(combination.title)

    if (!variantId) {
      unmatched.push(combination.title)
      continue
    }

    pricing.push({ ...item, variant_id: variantId })
  }

  const metafields = metafieldValues(form, ctx).values
  const seoTitle = normalizeSeoValue(form.seo.title)
  const seoDescription = normalizeSeoValue(form.seo.description)
  const seo: AdminUpdateProductSeoPayload = {}

  if (seoTitle) seo.title = seoTitle
  if (seoDescription) seo.description = seoDescription

  return {
    pricing: pricing.length || unmatched.length ? pricing : null,
    metafields: metafields.length ? metafields : null,
    seo: Object.keys(seo).length ? seo : null,
    package: form.shipping.package_preset_id,
    unmatched_variants: unmatched,
  }
}

// The parts to save, in the order the page lists them.
export const followUpParts = (requests: FollowUpRequests): FollowUpPart[] =>
  (["pricing", "metafields", "seo", "package"] as const).filter(
    (part) => requests[part] !== null
  )

// Removes a media item. Removing the picked thumbnail unpicks it, so the
// first remaining item becomes the thumbnail (the API's default).
export const removeMedia = (
  form: Pick<AddProductForm, "media_ids" | "thumbnail_id">,
  id: string
): Pick<AddProductForm, "media_ids" | "thumbnail_id"> => {
  const mediaIds = form.media_ids.filter((mediaId) => mediaId !== id)

  return {
    media_ids: mediaIds,
    thumbnail_id: form.thumbnail_id === id ? null : form.thumbnail_id,
  }
}

// Adds media to the end, skipping what is already picked.
export const addMedia = (mediaIds: string[], added: string[]): string[] => [
  ...new Set([...mediaIds, ...added]),
]

// The media item the product's thumbnail will be: the one picked, else the
// first (the API's default).
export const effectiveThumbnailId = (
  form: Pick<AddProductForm, "media_ids" | "thumbnail_id">
): string | null =>
  form.thumbnail_id && form.media_ids.includes(form.thumbnail_id)
    ? form.thumbnail_id
    : (form.media_ids[0] ?? null)
