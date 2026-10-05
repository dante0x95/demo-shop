import { MedusaError } from "@medusajs/framework/utils"
import { MetafieldType } from "../models/metafield-definition"

// What the API accepts and returns: numbers and booleans keep their JSON type.
export type MetafieldValueData = string | number | boolean

type DefinitionShape = {
  key: string
  type: MetafieldType
  options?: unknown
}

type StoredValueShape = {
  key: string
  type: MetafieldType
  value: string
}

const EXPECTED_JSON_TYPE: Record<MetafieldType, string> = {
  text: "string",
  number: "number",
  boolean: "boolean",
  select: "string",
}

// Most values listed in an error message; the rest are counted.
const MAX_LISTED_VALUES = 10

const invalid = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message)

const listValues = (values: string[]) => {
  const listed = values.slice(0, MAX_LISTED_VALUES).map((v) => JSON.stringify(v))
  const rest = values.length - listed.length

  return rest > 0 ? `${listed.join(", ")} and ${rest} more` : listed.join(", ")
}

// A select definition stores its options as a jsonb string array.
export const selectOptions = (options: unknown): string[] | null =>
  Array.isArray(options)
    ? options.filter((option): option is string => typeof option === "string")
    : null

// Checks a value against a type and returns the text it is stored as.
// `options` restricts a select; without them (a value whose definition was
// deleted) a select is checked as plain text.
export const serializeMetafieldValue = (
  key: string,
  type: MetafieldType,
  value: unknown,
  options: string[] | null = null
): string => {
  const valid =
    type === "number"
      ? typeof value === "number" && Number.isFinite(value)
      : typeof value === EXPECTED_JSON_TYPE[type]

  if (!valid) {
    throw invalid(
      `Metafield ${key} is of type ${type} and needs a ${EXPECTED_JSON_TYPE[type]} value, received ${JSON.stringify(value)}`
    )
  }

  if (type === "select" && options && !options.includes(value as string)) {
    throw invalid(
      `Metafield ${key} must be one of its options: ${listValues(options)}`
    )
  }

  return String(value)
}

export const parseMetafieldValue = (
  type: MetafieldType,
  value: string
): MetafieldValueData => {
  switch (type) {
    case "number":
      return Number(value)
    case "boolean":
      return value === "true"
    default:
      return value
  }
}

// Empty text (or whitespace only) is shown as "no value" on the storefront.
export const isEmptyMetafieldValue = (type: MetafieldType, value: string) =>
  (type === "text" || type === "select") && !value.trim()

export type PreparedMetafieldValue = {
  key: string
  type: MetafieldType
  value: string
}

// Turns an edit of an owner's values into what is stored. A key with a
// definition takes the definition's type and options; a key without one can
// only edit a value that already exists ("unstructured"), checked against its
// stored type, with a select checked as plain text.
export const prepareMetafieldValues = (
  ownerType: string,
  input: { key: string; value: unknown }[],
  definitions: DefinitionShape[],
  existing: Pick<StoredValueShape, "key" | "type">[]
): PreparedMetafieldValue[] => {
  const definitionByKey = new Map(definitions.map((d) => [d.key, d]))
  const existingByKey = new Map(existing.map((v) => [v.key, v]))

  return input.map(({ key, value }) => {
    const definition = definitionByKey.get(key)

    if (definition) {
      return {
        key,
        type: definition.type,
        value: serializeMetafieldValue(
          key,
          definition.type,
          value,
          definition.type === "select"
            ? selectOptions(definition.options) ?? []
            : null
        ),
      }
    }

    const current = existingByKey.get(key)

    if (!current) {
      throw invalid(
        `No metafield definition with key ${key} exists for owner type ${ownerType}`
      )
    }

    return {
      key,
      type: current.type,
      value: serializeMetafieldValue(key, current.type, value),
    }
  })
}

// Why a new definition can't take over the values already stored under its
// owner type and key, or null when it can: they must have its type and, for a
// select, be among its options.
export const findMetafieldReconnectConflict = (
  definition: DefinitionShape,
  values: Pick<StoredValueShape, "type" | "value">[]
): string | null => {
  const otherTypes = [
    ...new Set(
      values.map((v) => v.type).filter((type) => type !== definition.type)
    ),
  ].sort()

  if (otherTypes.length) {
    return `Metafield definition ${definition.key} can't be of type ${definition.type}: existing values with this key are of type ${otherTypes.join(", ")}`
  }

  if (definition.type !== "select") {
    return null
  }

  const options = selectOptions(definition.options) ?? []
  const missing = [
    ...new Set(
      values.map((v) => v.value).filter((value) => !options.includes(value))
    ),
  ].sort()

  return missing.length
    ? `Metafield definition ${definition.key} needs every existing value among its options; missing: ${listValues(missing)}`
    : null
}

export type AdminMetafieldDefinitionSummary = {
  id: string
  label: string
  type: MetafieldType
  options: unknown
  storefront_access: boolean
}

// An owner's values as the admin sees them, ordered by key. `definition` is
// null for an unstructured value (its definition was deleted).
export const toAdminMetafields = <
  V extends StoredValueShape & {
    id: string
    created_at: unknown
    updated_at: unknown
  },
>(
  values: V[],
  definitions: (AdminMetafieldDefinitionSummary & { key: string })[]
) => {
  const definitionByKey = new Map(definitions.map((d) => [d.key, d]))

  return [...values]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((value) => {
      const definition = definitionByKey.get(value.key)

      return {
        id: value.id,
        key: value.key,
        type: value.type,
        value: parseMetafieldValue(value.type, value.value),
        definition: definition
          ? {
              id: definition.id,
              label: definition.label,
              type: definition.type,
              options: definition.options ?? null,
              storefront_access: definition.storefront_access,
            }
          : null,
        created_at: value.created_at,
        updated_at: value.updated_at,
      }
    })
}

// The storefront's view of the requested keys: every key is present, and a
// key without a value, with an empty value, without a definition, or whose
// definition is private is null.
export const resolveStorefrontMetafields = (
  keys: string[],
  definitions: (DefinitionShape & { storefront_access: boolean })[],
  values: StoredValueShape[]
): Record<string, MetafieldValueData | null> => {
  const publicDefinitions = new Map(
    definitions.filter((d) => d.storefront_access).map((d) => [d.key, d])
  )
  const valueByKey = new Map(values.map((v) => [v.key, v]))

  return Object.fromEntries(
    keys.map((key) => {
      const definition = publicDefinitions.get(key)
      const stored = valueByKey.get(key)

      if (
        !definition ||
        !stored ||
        stored.type !== definition.type ||
        isEmptyMetafieldValue(stored.type, stored.value)
      ) {
        return [key, null]
      }

      return [key, parseMetafieldValue(stored.type, stored.value)]
    })
  )
}
