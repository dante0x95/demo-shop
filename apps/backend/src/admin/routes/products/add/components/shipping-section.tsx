import { Combobox, CountrySelect } from "@medusajs/dashboard/components"
import { Input, Select } from "@medusajs/ui"
import { PickerOption } from "../../../../lib/add-product"
import { AdminPackagePreset } from "../../../../lib/package-presets"
import {
  fromPackagePresetOption,
  packagePresetOptionLabel,
  storeDefaultOptionLabel,
  toPackagePresetOption,
} from "../../../../components/package-preset/utils"
import { AddProductErrors, ShippingForm } from "../utils"
import { errorProps, Field, Section } from "./field"

type ShippingSectionProps = {
  shipping: ShippingForm
  presets: AdminPackagePreset[]
  shippingProfiles: PickerOption[]
  errors: AddProductErrors
  disabled: boolean
  onChange: (changes: Partial<ShippingForm>) => void
}

const MEASURES = [
  ["weight", "Weight"],
  ["length", "Length"],
  ["width", "Width"],
  ["height", "Height"],
] as const

// Package (T23), shipping profile, size and weight, and the customs
// information (origin and HS code).
export const ShippingSection = ({
  shipping,
  presets,
  shippingProfiles,
  errors,
  disabled,
  onChange,
}: ShippingSectionProps) => (
  <Section title="Shipping" testId="add-product-shipping">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field
        id="product-package"
        label="Package"
        hint="The box it ships in when shipped alone"
      >
        <Select
          value={toPackagePresetOption(shipping.package_preset_id)}
          onValueChange={(value) =>
            onChange({ package_preset_id: fromPackagePresetOption(value) })
          }
          disabled={disabled}
        >
          <Select.Trigger id="product-package">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={toPackagePresetOption(null)}>
              {storeDefaultOptionLabel(presets)}
            </Select.Item>
            {presets.map((preset) => (
              <Select.Item key={preset.id} value={preset.id}>
                {packagePresetOptionLabel(preset)}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </Field>
      <Field id="product-shipping-profile" label="Shipping profile" optional>
        <Combobox<string>
          id="product-shipping-profile"
          value={shipping.shipping_profile_id}
          options={shippingProfiles}
          onChange={(value) => onChange({ shipping_profile_id: value ?? "" })}
          allowClear
          disabled={disabled}
        />
      </Field>
    </div>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {MEASURES.map(([field, label]) => {
        const id = `product-${field}`
        const error = errors[`shipping.${field}`]

        return (
          <Field key={field} id={id} label={label} error={error} optional>
            <Input
              id={id}
              inputMode="decimal"
              value={shipping[field]}
              onChange={(e) => onChange({ [field]: e.target.value })}
              disabled={disabled}
              {...errorProps(id, error)}
            />
          </Field>
        )
      })}
    </div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field id="product-origin-country" label="Country of origin" optional>
        <CountrySelect
          id="product-origin-country"
          value={shipping.origin_country}
          onChange={(value) => onChange({ origin_country: value ?? "" })}
          allowClear
          disabled={disabled}
        />
      </Field>
      <Field
        id="product-hs-code"
        label="HS code"
        hint="Harmonized System code for customs"
        optional
      >
        <Input
          id="product-hs-code"
          value={shipping.hs_code}
          onChange={(e) => onChange({ hs_code: e.target.value })}
          disabled={disabled}
        />
      </Field>
    </div>
  </Section>
)
