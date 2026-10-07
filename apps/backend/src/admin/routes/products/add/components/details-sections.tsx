import { Input, Text, Textarea } from "@medusajs/ui"
import { ProductMetafieldField } from "../../../../lib/metafield-form"
import { MetafieldInput } from "../../../../components/product-metafields/metafield-input"
import {
  productSeoFallbacks,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  seoCounter,
} from "../../../../components/product-seo/utils"
import { AddProductErrors, AddProductForm } from "../utils"
import { errorProps, Field, Section } from "./field"

type GeneralSectionProps = {
  title: string
  description: string
  errors: AddProductErrors
  disabled: boolean
  onChange: (
    changes: Partial<Pick<AddProductForm, "title" | "description">>
  ) => void
}

export const GeneralSection = ({
  title,
  description,
  errors,
  disabled,
  onChange,
}: GeneralSectionProps) => (
  <Section title="General">
    <Field id="product-title" label="Title" error={errors.title}>
      <Input
        id="product-title"
        placeholder="Short sleeve t-shirt"
        value={title}
        onChange={(e) => onChange({ title: e.target.value })}
        disabled={disabled}
        {...errorProps("product-title", errors.title)}
      />
    </Field>
    <Field id="product-description" label="Description" optional>
      <Textarea
        id="product-description"
        rows={5}
        value={description}
        onChange={(e) => onChange({ description: e.target.value })}
        disabled={disabled}
      />
    </Field>
  </Section>
)

type MetafieldsSectionProps = {
  fields: ProductMetafieldField[]
  inputs: Record<string, string>
  errors: AddProductErrors
  disabled: boolean
  onChange: (key: string, value: string) => void
}

// One input per product metafield definition (T20). Empty inputs save
// nothing.
export const MetafieldsSection = ({
  fields,
  inputs,
  errors,
  disabled,
  onChange,
}: MetafieldsSectionProps) => (
  <Section title="Metafields" testId="add-product-metafields">
    {fields.map((field) => {
      const id = `product-metafield-${field.key}`
      const error = errors[`metafields.${field.key}`]

      return (
        <Field
          key={field.key}
          id={id}
          label={field.label}
          error={error}
          optional
        >
          <MetafieldInput
            field={field}
            id={id}
            value={inputs[field.key] ?? ""}
            onChange={(value) => onChange(field.key, value)}
            disabled={disabled}
          />
        </Field>
      )
    })}
  </Section>
)

type SeoSectionProps = {
  seo: AddProductForm["seo"]
  handle: string
  product: Pick<AddProductForm, "title" | "description">
  disabled: boolean
  onChange: (changes: { seo?: AddProductForm["seo"]; handle?: string }) => void
}

const Counter = ({ value, limit }: { value: string; limit: number }) => {
  const counter = seoCounter(value, limit)

  return (
    <Text
      size="small"
      leading="compact"
      className={counter.over ? "text-ui-fg-error" : "text-ui-fg-subtle"}
    >
      {counter.text}
    </Text>
  )
}

// T22's SEO title and meta description, with their fallbacks as
// placeholders, and the URL handle.
export const SeoSection = ({
  seo,
  handle,
  product,
  disabled,
  onChange,
}: SeoSectionProps) => {
  const fallbacks = productSeoFallbacks(product)

  return (
    <Section
      title="Search engine listing"
      description="Leave a field empty to use the product's title or description."
      testId="add-product-seo"
    >
      <Field id="product-seo-title" label="Page title" optional>
        <Input
          id="product-seo-title"
          placeholder={fallbacks.title}
          value={seo.title}
          onChange={(e) => onChange({ seo: { ...seo, title: e.target.value } })}
          disabled={disabled}
        />
        <Counter value={seo.title} limit={SEO_TITLE_LIMIT} />
      </Field>
      <Field id="product-seo-description" label="Meta description" optional>
        <Textarea
          id="product-seo-description"
          rows={3}
          placeholder={fallbacks.description}
          value={seo.description}
          onChange={(e) =>
            onChange({ seo: { ...seo, description: e.target.value } })
          }
          disabled={disabled}
        />
        <Counter value={seo.description} limit={SEO_DESCRIPTION_LIMIT} />
      </Field>
      <Field
        id="product-handle"
        label="URL handle"
        hint="Leave empty to create it from the title"
        optional
      >
        <Input
          id="product-handle"
          value={handle}
          onChange={(e) => onChange({ handle: e.target.value })}
          disabled={disabled}
        />
      </Field>
    </Section>
  )
}
