// Type-only imports: this file stays free of the SDK so unit tests can load it.
import type {
  AdminCreateMetafieldDefinitionPayload,
  AdminMetafieldDefinition,
  AdminProductMetafield,
  MetafieldType,
  MetafieldValueData,
} from "./metafields"

export const METAFIELD_TYPE_LABELS: Record<MetafieldType, string> = {
  text: "Text",
  number: "Number",
  boolean: "True or false",
  select: "Select",
}

export const METAFIELD_TYPES = Object.keys(
  METAFIELD_TYPE_LABELS
) as MetafieldType[]

// The API's rule for a key: a lowercase letter, then up to 63 lowercase
// letters, digits or underscores.
const MAX_KEY_LENGTH = 64

// "product_variant" -> "Product variant".
export const ownerTypeLabel = (ownerType: string) => {
  const words = ownerType.replace(/[_-]+/g, " ").trim()

  return words ? words[0].toUpperCase() + words.slice(1) : ownerType
}

// A snake_case key derived from a label, e.g. "Care & Washing" ->
// "care_washing". Empty when the label has no letter to start a key with.
export const suggestMetafieldKey = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .slice(0, MAX_KEY_LENGTH)
    .replace(/_+$/, "")

// One option per line; blank lines are ignored.
export const parseSelectOptions = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

export type CreateMetafieldDefinitionFormState = {
  label: string
  key: string
  type: MetafieldType | ""
  options: string
}

// An unselected type is omitted so the API's 400 names it; options are sent
// only for a select (the API rejects them on other types).
export const toCreateMetafieldDefinitionPayload = (
  form: CreateMetafieldDefinitionFormState,
  ownerType: string
): AdminCreateMetafieldDefinitionPayload => {
  const payload: AdminCreateMetafieldDefinitionPayload = {
    key: form.key.trim(),
    label: form.label,
    owner_type: ownerType,
  }

  if (form.type) {
    payload.type = form.type
  }

  if (form.type === "select") {
    payload.options = parseSelectOptions(form.options)
  }

  return payload
}

// One editable metafield of a product: a definition (with or without a
// value) or an unstructured value (a value whose definition was deleted).
export type ProductMetafieldField = {
  key: string
  label: string
  type: MetafieldType
  // A select's options; null without a definition, where a select is
  // edited as plain text.
  options: string[] | null
  value: MetafieldValueData | null
  unstructured: boolean
}

const byKey = (a: { key: string }, b: { key: string }) =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0

// The product's definitions first, each with its value when it has one,
// then its unstructured values; both ordered by key.
export const buildProductMetafieldFields = (
  definitions: Pick<AdminMetafieldDefinition, "key" | "label" | "type" | "options">[],
  values: Pick<AdminProductMetafield, "key" | "type" | "value" | "definition">[]
): ProductMetafieldField[] => {
  const valueByKey = new Map(values.map((value) => [value.key, value]))
  const definitionKeys = new Set(definitions.map((d) => d.key))

  const defined = [...definitions].sort(byKey).map((definition) => ({
    key: definition.key,
    label: definition.label,
    type: definition.type,
    options: definition.type === "select" ? definition.options ?? [] : null,
    value: valueByKey.get(definition.key)?.value ?? null,
    unstructured: false,
  }))

  // A value whose definition the list doesn't include yet (created after the
  // list loaded) still shows, with what the value knows about it.
  const others = values
    .filter((value) => !definitionKeys.has(value.key))
    .sort(byKey)
    .map((value) => ({
      key: value.key,
      label: value.definition?.label ?? value.key,
      type: value.type,
      options:
        value.definition?.type === "select"
          ? value.definition.options ?? []
          : null,
      value: value.value,
      unstructured: !value.definition,
    }))

  return [...defined, ...others]
}

export const formatMetafieldValue = (
  value: MetafieldValueData | null
): string => {
  if (value === null) {
    return "-"
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False"
  }

  return String(value)
}

// A select item can't have an empty value, and any text can be one of a
// definition's options. Options get a prefix, so "no value" never collides
// with one.
const NO_VALUE_ITEM = "none"
const OPTION_ITEM_PREFIX = "option:"

export const toSelectItemValue = (input: string) =>
  input ? `${OPTION_ITEM_PREFIX}${input}` : NO_VALUE_ITEM

export const fromSelectItemValue = (item: string) =>
  item.startsWith(OPTION_ITEM_PREFIX)
    ? item.slice(OPTION_ITEM_PREFIX.length)
    : ""

// What a form input holds for a value: text for every type, "true" or
// "false" for a boolean, and "" for no value.
export const toMetafieldInputValue = (value: MetafieldValueData | null) =>
  value === null ? "" : String(value)

export type ProductMetafieldChanges = {
  set: { key: string; value: MetafieldValueData }[]
  remove: string[]
  errors: string[]
}

// Turns the edited inputs into the requests to send. Unchanged fields are
// skipped; an emptied field removes the product's value (an empty text is
// shown as "no value" on the storefront anyway).
export const buildProductMetafieldChanges = (
  fields: ProductMetafieldField[],
  inputs: Record<string, string>
): ProductMetafieldChanges => {
  const changes: ProductMetafieldChanges = { set: [], remove: [], errors: [] }

  for (const field of fields) {
    const input = inputs[field.key] ?? toMetafieldInputValue(field.value)

    if (input === toMetafieldInputValue(field.value)) {
      continue
    }

    if (!input.trim()) {
      if (field.value !== null) {
        changes.remove.push(field.key)
      }
      continue
    }

    if (field.type === "number") {
      const value = Number(input.trim())

      if (!Number.isFinite(value)) {
        changes.errors.push(`${field.label} must be a number`)
        continue
      }

      changes.set.push({ key: field.key, value })
    } else if (field.type === "boolean") {
      changes.set.push({ key: field.key, value: input === "true" })
    } else {
      changes.set.push({ key: field.key, value: input })
    }
  }

  return changes
}
