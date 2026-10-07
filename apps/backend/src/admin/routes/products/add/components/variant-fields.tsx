import { Input, Text } from "@medusajs/ui"
import { PickerOption } from "../../../../lib/add-product"
import { compareAtHiddenReason } from "../../../../components/variant-pricing/utils"
import { AddProductErrors, parseAmountInput, VariantFormRow } from "../utils"
import { errorProps, Field } from "./field"

type VariantFieldsProps = {
  // The variant's key in the form (and in error keys).
  variantKey: string
  row: VariantFormRow
  onChange: (row: VariantFormRow) => void
  errors: AddProductErrors
  disabled: boolean
}

// An id an input can use: variant keys are JSON arrays.
const inputId = (variantKey: string, field: string) =>
  `variant-${encodeURIComponent(variantKey).replace(/%/g, "_")}-${field}`

const AmountInput = ({
  id,
  value,
  error,
  currencyCode,
  disabled,
  onChange,
}: {
  id: string
  value: string
  error?: string
  currencyCode: string | null
  disabled: boolean
  onChange: (value: string) => void
}) => (
  <div className="relative">
    <Input
      id={id}
      inputMode="decimal"
      placeholder="0.00"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={currencyCode ? "pr-14" : undefined}
      {...errorProps(id, error)}
    />
    {currencyCode && (
      <Text
        size="small"
        leading="compact"
        className="text-ui-fg-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
      >
        {currencyCode.toUpperCase()}
      </Text>
    )}
  </div>
)

// Price, compare-at price and cost per item of one variant, in the store's
// default currency (amounts as typed: 49.99 = 49.99).
export const PricingFields = ({
  variantKey,
  row,
  onChange,
  errors,
  disabled,
  currencyCode,
}: VariantFieldsProps & { currencyCode: string | null }) => {
  const at = `variants.${variantKey}`
  const set =
    (field: "price" | "compare_at_amount" | "cost_amount") => (value: string) =>
      onChange({ ...row, [field]: value })

  // T21's storefront rule, as a hint while typing.
  const price = parseAmountInput(row.price)
  const compareAt = parseAmountInput(row.compare_at_amount)
  const compareAtHint =
    compareAt != null && price !== undefined
      ? (compareAtHiddenReason(compareAt, price) ?? undefined)
      : undefined

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {(
        [
          ["price", "Price", undefined],
          ["compare_at_amount", "Compare-at price", compareAtHint],
          ["cost_amount", "Cost per item", "Customers won't see this"],
        ] as const
      ).map(([field, label, hint]) => {
        const id = inputId(variantKey, field)
        const error = errors[`${at}.${field}`]

        return (
          <Field
            key={field}
            id={id}
            label={label}
            hint={hint}
            error={error}
            optional={field !== "price"}
          >
            <AmountInput
              id={id}
              value={row[field]}
              error={error}
              currencyCode={currencyCode}
              disabled={disabled}
              onChange={set(field)}
            />
          </Field>
        )
      })}
    </div>
  )
}

// SKU, barcode and, when the product tracks inventory, the quantity in
// stock at each location.
export const InventoryFields = ({
  variantKey,
  row,
  onChange,
  errors,
  disabled,
  locations,
  trackInventory,
}: VariantFieldsProps & {
  locations: PickerOption[]
  trackInventory: boolean
}) => {
  const at = `variants.${variantKey}`
  const skuId = inputId(variantKey, "sku")
  const barcodeId = inputId(variantKey, "barcode")

  return (
    <div className="flex flex-col gap-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field id={skuId} label="SKU" optional>
          <Input
            id={skuId}
            value={row.sku}
            onChange={(e) => onChange({ ...row, sku: e.target.value })}
            disabled={disabled}
          />
        </Field>
        <Field
          id={barcodeId}
          label="Barcode"
          hint="ISBN, UPC, GTIN, etc."
          optional
        >
          <Input
            id={barcodeId}
            value={row.barcode}
            onChange={(e) => onChange({ ...row, barcode: e.target.value })}
            disabled={disabled}
          />
        </Field>
      </div>
      {trackInventory &&
        (locations.length ? (
          <div className="flex flex-col gap-y-2">
            <Text size="small" leading="compact" weight="plus">
              Quantity per location
            </Text>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {locations.map((location) => {
                const id = inputId(variantKey, `stock-${location.value}`)
                const error = errors[`${at}.stock.${location.value}`]

                return (
                  <Field
                    key={location.value}
                    id={id}
                    label={location.label}
                    error={error}
                  >
                    <Input
                      id={id}
                      inputMode="numeric"
                      placeholder="Not stocked"
                      value={row.stock[location.value] ?? ""}
                      onChange={(e) =>
                        onChange({
                          ...row,
                          stock: {
                            ...row.stock,
                            [location.value]: e.target.value,
                          },
                        })
                      }
                      disabled={disabled}
                      {...errorProps(id, error)}
                    />
                  </Field>
                )
              })}
            </div>
          </div>
        ) : (
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            The store has no stock locations yet, so no quantities can be set.
            Add one in Settings, Locations & Shipping.
          </Text>
        ))}
    </div>
  )
}
