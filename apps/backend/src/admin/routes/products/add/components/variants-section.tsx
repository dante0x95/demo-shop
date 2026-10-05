import { Plus, Trash } from "@medusajs/icons"
import { Button, IconButton, Input, Text } from "@medusajs/ui"
import { PickerOption } from "../../../../lib/add-product"
import {
  AddProductErrors,
  DEFAULT_VARIANT_KEY,
  emptyVariantRow,
  OptionFormRow,
  VariantCombination,
  VariantFormRow,
} from "../utils"
import { errorProps, Field, Section } from "./field"
import { InventoryFields, PricingFields } from "./variant-fields"

type VariantsSectionProps = {
  options: OptionFormRow[]
  combinations: VariantCombination[]
  variants: Record<string, VariantFormRow>
  errors: AddProductErrors
  currencyCode: string | null
  locations: PickerOption[]
  trackInventory: boolean
  disabled: boolean
  onAddOption: () => void
  onChangeOption: (option: OptionFormRow) => void
  onRemoveOption: (key: string) => void
  onChangeVariant: (key: string, row: VariantFormRow) => void
}

// Options like Size or Color, and one group of fields per variant they make.
// Without options the product has a single variant, edited in the Pricing
// and Inventory sections instead.
export const VariantsSection = ({
  options,
  combinations,
  variants,
  errors,
  currencyCode,
  locations,
  trackInventory,
  disabled,
  onAddOption,
  onChangeOption,
  onRemoveOption,
  onChangeVariant,
}: VariantsSectionProps) => {
  const hasVariants = combinations[0]?.key !== DEFAULT_VARIANT_KEY

  return (
    <Section
      title="Variants"
      description="Add options like size or color. Each combination of their values is a variant."
      testId="add-product-variants"
      actions={
        <Button
          size="small"
          variant="secondary"
          type="button"
          onClick={onAddOption}
          disabled={disabled}
        >
          <Plus />
          Add option
        </Button>
      }
    >
      {options.map((option, index) => {
        const titleId = `option-${option.key}-title`
        const valuesId = `option-${option.key}-values`
        const titleError = errors[`options.${option.key}.title`]
        const valuesError = errors[`options.${option.key}.values`]

        return (
          <fieldset
            key={option.key}
            aria-label={`Option ${index + 1}`}
            className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_2fr_auto]"
          >
            <Field id={titleId} label="Option name" error={titleError}>
              <Input
                id={titleId}
                placeholder="Size"
                value={option.title}
                onChange={(e) =>
                  onChangeOption({ ...option, title: e.target.value })
                }
                disabled={disabled}
                {...errorProps(titleId, titleError)}
              />
            </Field>
            <Field
              id={valuesId}
              label="Option values"
              hint="Separate values with commas"
              error={valuesError}
            >
              <Input
                id={valuesId}
                placeholder="S, M, L"
                value={option.values}
                onChange={(e) =>
                  onChangeOption({ ...option, values: e.target.value })
                }
                disabled={disabled}
                {...errorProps(valuesId, valuesError)}
              />
            </Field>
            <IconButton
              size="small"
              variant="transparent"
              type="button"
              className="md:mt-7"
              aria-label={`Remove option ${index + 1}`}
              onClick={() => onRemoveOption(option.key)}
              disabled={disabled}
            >
              <Trash />
            </IconButton>
          </fieldset>
        )
      })}
      {hasVariants ? (
        <div className="flex flex-col gap-y-3">
          <Text size="small" leading="compact" weight="plus">
            {combinations.length === 1
              ? "1 variant"
              : `${combinations.length} variants`}
          </Text>
          {combinations.map((combination) => {
            const row = variants[combination.key] ?? emptyVariantRow()
            const onChange = (next: VariantFormRow) =>
              onChangeVariant(combination.key, next)

            return (
              <fieldset
                key={combination.key}
                aria-label={combination.title}
                className="bg-ui-bg-subtle flex flex-col gap-y-4 rounded-md p-4"
              >
                <Text size="small" leading="compact" weight="plus">
                  {combination.title}
                </Text>
                <PricingFields
                  variantKey={combination.key}
                  row={row}
                  onChange={onChange}
                  errors={errors}
                  disabled={disabled}
                  currencyCode={currencyCode}
                />
                <InventoryFields
                  variantKey={combination.key}
                  row={row}
                  onChange={onChange}
                  errors={errors}
                  disabled={disabled}
                  locations={locations}
                  trackInventory={trackInventory}
                />
              </fieldset>
            )
          })}
        </div>
      ) : (
        !options.length && (
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            No options: the product is sold as a single variant.
          </Text>
        )
      )}
    </Section>
  )
}
