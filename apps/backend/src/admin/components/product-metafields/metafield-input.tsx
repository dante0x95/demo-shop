import { Input, Select, Textarea } from "@medusajs/ui"
import {
  fromSelectItemValue,
  ProductMetafieldField,
  toSelectItemValue,
} from "../../lib/metafield-form"

// The input for one metafield, by its type: a select for a boolean or a
// select with options, a number input, or a textarea for text.
export const MetafieldInput = ({
  field,
  id,
  value,
  onChange,
  disabled,
}: {
  field: ProductMetafieldField
  id: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) => {
  if (field.type === "boolean" || (field.type === "select" && field.options)) {
    const options =
      field.type === "boolean"
        ? [
            { value: "true", label: "True" },
            { value: "false", label: "False" },
          ]
        : (field.options ?? []).map((option) => ({
            value: option,
            label: option,
          }))

    return (
      <Select
        value={toSelectItemValue(value)}
        onValueChange={(next) => onChange(fromSelectItemValue(next))}
        disabled={disabled}
      >
        <Select.Trigger id={id}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={toSelectItemValue("")}>No value</Select.Item>
          {options.map((option) => (
            <Select.Item
              key={option.value}
              value={toSelectItemValue(option.value)}
            >
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    )
  }

  if (field.type === "number") {
    return (
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    )
  }

  // Text, and a select without its definition (checked as plain text).
  return (
    <Textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={field.type === "text" ? 3 : 1}
    />
  )
}
