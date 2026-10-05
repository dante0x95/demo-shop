import { Combobox } from "@medusajs/dashboard/components"
import { Select } from "@medusajs/ui"
import { PickerOption } from "../../../../lib/add-product"
import { AddProductForm, ProductStatus } from "../utils"
import { Field, Section } from "./field"

export type OrganizationOptions = {
  salesChannels: PickerOption[]
  categories: PickerOption[]
  types: PickerOption[]
  brands: PickerOption[]
  collections: PickerOption[]
  tags: PickerOption[]
}

type OrganizationFields = Pick<
  AddProductForm,
  | "status"
  | "sales_channel_ids"
  | "category_ids"
  | "type_id"
  | "brand_id"
  | "collection_id"
  | "tag_ids"
>

type OrganizationSectionProps = {
  form: OrganizationFields
  options: OrganizationOptions
  disabled: boolean
  onChange: (changes: Partial<OrganizationFields>) => void
}

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
]

const MultiPicker = ({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: string[]
  options: PickerOption[]
  disabled: boolean
  onChange: (value: string[]) => void
}) => (
  <Field id={id} label={label} optional>
    <Combobox<string[]>
      id={id}
      displayMode="chips"
      value={value}
      options={options}
      onChange={(next) => onChange(next ?? [])}
      disabled={disabled}
    />
  </Field>
)

const SinglePicker = ({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: PickerOption[]
  disabled: boolean
  onChange: (value: string) => void
}) => (
  <Field id={id} label={label} optional>
    <Combobox<string>
      id={id}
      value={value}
      options={options}
      onChange={(next) => onChange(next ?? "")}
      allowClear
      disabled={disabled}
    />
  </Field>
)

// The side column: status, where the product is sold and how it is
// organized. Pickers list what exists; new types, tags and the like are
// created in their own settings first.
export const OrganizationSections = ({
  form,
  options,
  disabled,
  onChange,
}: OrganizationSectionProps) => (
  <>
    <Section title="Status">
      <Field id="product-status" label="Status">
        <Select
          value={form.status}
          onValueChange={(value) =>
            onChange({ status: value as ProductStatus })
          }
          disabled={disabled}
        >
          <Select.Trigger id="product-status">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {STATUS_OPTIONS.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </Field>
    </Section>
    <Section title="Publishing">
      <MultiPicker
        id="product-sales-channels"
        label="Sales channels"
        value={form.sales_channel_ids}
        options={options.salesChannels}
        disabled={disabled}
        onChange={(value) => onChange({ sales_channel_ids: value })}
      />
    </Section>
    <Section title="Organization">
      <MultiPicker
        id="product-categories"
        label="Categories"
        value={form.category_ids}
        options={options.categories}
        disabled={disabled}
        onChange={(value) => onChange({ category_ids: value })}
      />
      <SinglePicker
        id="product-type"
        label="Type"
        value={form.type_id}
        options={options.types}
        disabled={disabled}
        onChange={(value) => onChange({ type_id: value })}
      />
      <SinglePicker
        id="product-vendor"
        label="Vendor (brand)"
        value={form.brand_id}
        options={options.brands}
        disabled={disabled}
        onChange={(value) => onChange({ brand_id: value })}
      />
      <SinglePicker
        id="product-collection"
        label="Collection"
        value={form.collection_id}
        options={options.collections}
        disabled={disabled}
        onChange={(value) => onChange({ collection_id: value })}
      />
      <MultiPicker
        id="product-tags"
        label="Tags"
        value={form.tag_ids}
        options={options.tags}
        disabled={disabled}
        onChange={(value) => onChange({ tag_ids: value })}
      />
    </Section>
  </>
)
