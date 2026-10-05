import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Spinner } from "@medusajs/icons"
import {
  Button,
  Checkbox,
  Container,
  Heading,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  addProductQueryKeys,
  AdminCreatedProductFull,
  createProductFull,
  listBrandOptions,
  listCategoryOptions,
  listCollectionOptions,
  listSalesChannelOptions,
  listShippingProfileOptions,
  listStockLocationOptions,
  listTagOptions,
  listTypeOptions,
  retrieveStoreDefaults,
} from "../../../lib/add-product"
import { brandQueryKeys } from "../../../lib/brands"
import { AdminMediaAsset } from "../../../lib/media"
import { buildProductMetafieldFields } from "../../../lib/metafield-form"
import {
  listAllMetafieldDefinitions,
  metafieldQueryKeys,
  PRODUCT_OWNER_TYPE,
  setProductMetafields,
} from "../../../lib/metafields"
import {
  listAllPackagePresets,
  packagePresetQueryKeys,
  setProductPackagePreset,
} from "../../../lib/package-presets"
import { updateProductSeo } from "../../../lib/product-seo"
import { updateVariantPricing } from "../../../lib/variant-pricing"
import { findDefaultCurrencyCode } from "../../../../modules/variant-pricing/utils/variant-pricing"
import {
  GeneralSection,
  MetafieldsSection,
  SeoSection,
} from "./components/details-sections"
import { Section } from "./components/field"
import { MediaSection } from "./components/media-section"
import { OrganizationSections } from "./components/organization-section"
import { PartStatus, SaveStatus } from "./components/save-status"
import { ShippingSection } from "./components/shipping-section"
import { InventoryFields, PricingFields } from "./components/variant-fields"
import { VariantsSection } from "./components/variants-section"
import {
  addMedia,
  AddProductContext,
  AddProductErrors,
  AddProductForm,
  buildCreateProductFullPayload,
  buildFollowUpRequests,
  buildVariantCombinations,
  DEFAULT_VARIANT_KEY,
  emptyAddProductForm,
  emptyVariantRow,
  followUpParts,
  FollowUpPart,
  FollowUpRequests,
  OptionFormRow,
  removeMedia,
  VariantFormRow,
} from "./utils"

let nextOptionKey = 0

type Created = {
  product: AdminCreatedProductFull
  requests: FollowUpRequests
}

// Sends one part saved after the product exists to its T20-T23 endpoint.
const saveFollowUp = async (
  part: FollowUpPart,
  productId: string,
  requests: FollowUpRequests
) => {
  switch (part) {
    case "pricing":
      if (requests.pricing?.length) {
        await updateVariantPricing(productId, requests.pricing)
      }
      if (requests.unmatched_variants.length) {
        throw new Error(
          `These variants weren't found on the created product: ${requests.unmatched_variants.join(", ")}`
        )
      }
      return
    case "metafields":
      await setProductMetafields(productId, requests.metafields ?? [])
      return
    case "seo":
      await updateProductSeo(productId, requests.seo ?? {})
      return
    case "package":
      await setProductPackagePreset(productId, requests.package)
      return
  }
}

const AddProductPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<AddProductForm>(() => emptyAddProductForm())
  const [errors, setErrors] = useState<AddProductErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [assets, setAssets] = useState<Record<string, AdminMediaAsset>>({})
  const [created, setCreated] = useState<Created | null>(null)
  const [parts, setParts] = useState<Partial<Record<FollowUpPart, PartStatus>>>(
    {}
  )
  const salesChannelsTouched = useRef(false)
  const finished = useRef(false)
  const topRef = useRef<HTMLDivElement>(null)

  const storeQuery = useQuery({
    queryKey: addProductQueryKeys.store,
    queryFn: retrieveStoreDefaults,
  })
  const locationsQuery = useQuery({
    queryKey: addProductQueryKeys.stockLocations,
    queryFn: listStockLocationOptions,
  })
  const definitionsQuery = useQuery({
    queryKey: metafieldQueryKeys.allDefinitions(PRODUCT_OWNER_TYPE),
    queryFn: () => listAllMetafieldDefinitions(PRODUCT_OWNER_TYPE),
  })
  const presetsQuery = useQuery({
    queryKey: packagePresetQueryKeys.options(),
    queryFn: listAllPackagePresets,
  })
  const { data: salesChannels = [] } = useQuery({
    queryKey: addProductQueryKeys.salesChannels,
    queryFn: listSalesChannelOptions,
  })
  const { data: categories = [] } = useQuery({
    queryKey: addProductQueryKeys.categories,
    queryFn: listCategoryOptions,
  })
  const { data: types = [] } = useQuery({
    queryKey: addProductQueryKeys.types,
    queryFn: listTypeOptions,
  })
  const { data: brands = [] } = useQuery({
    queryKey: addProductQueryKeys.brands,
    queryFn: listBrandOptions,
  })
  const { data: collections = [] } = useQuery({
    queryKey: addProductQueryKeys.collections,
    queryFn: listCollectionOptions,
  })
  const { data: tags = [] } = useQuery({
    queryKey: addProductQueryKeys.tags,
    queryFn: listTagOptions,
  })
  const { data: shippingProfiles = [] } = useQuery({
    queryKey: addProductQueryKeys.shippingProfiles,
    queryFn: listShippingProfileOptions,
  })

  // New products are sold in the store's default sales channel unless the
  // admin changes it, like Medusa's own product form.
  const defaultSalesChannelId = storeQuery.data?.default_sales_channel_id

  useEffect(() => {
    if (defaultSalesChannelId && !salesChannelsTouched.current) {
      setForm((prev) => ({
        ...prev,
        sales_channel_ids: [defaultSalesChannelId],
      }))
    }
  }, [defaultSalesChannelId])

  const currencyCode = findDefaultCurrencyCode(
    storeQuery.data?.supported_currencies
  )
  const locations = locationsQuery.data ?? []
  const definitions = definitionsQuery.data ?? []

  const ctx: AddProductContext = {
    currency_code: currencyCode,
    location_ids: locations.map((location) => location.value),
    metafield_definitions: definitions,
  }

  const metafieldFields = useMemo(
    () => buildProductMetafieldFields(definitions, []),
    [definitions]
  )
  const combinations = useMemo(
    () => buildVariantCombinations(form.options),
    [form.options]
  )
  const isSingleVariant = combinations[0]?.key === DEFAULT_VARIANT_KEY

  const finish = (product: AdminCreatedProductFull) => {
    if (finished.current) {
      return
    }

    finished.current = true
    queryClient.invalidateQueries({ queryKey: ["products"] })
    queryClient.invalidateQueries({ queryKey: brandQueryKeys.all })
    toast.success(`"${product.title}" created`)
    navigate(`/products/${product.id}`)
  }

  const runParts = (
    toRun: FollowUpPart[],
    productId: string,
    requests: FollowUpRequests
  ) => {
    setParts((prev) => ({
      ...prev,
      ...Object.fromEntries(toRun.map((part) => [part, { state: "saving" }])),
    }))

    for (const part of toRun) {
      saveFollowUp(part, productId, requests).then(
        () => setParts((prev) => ({ ...prev, [part]: { state: "saved" } })),
        (err: Error) =>
          setParts((prev) => ({
            ...prev,
            [part]: { state: "failed", error: err.message || "Failed to save" },
          }))
      )
    }
  }

  // Everything saved: go to the new product. A failed part keeps the page
  // here until it is retried.
  useEffect(() => {
    const statuses = Object.values(parts)

    if (
      created &&
      statuses.length &&
      statuses.every((s) => s.state === "saved")
    ) {
      finish(created.product)
    }
  }, [parts, created])

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: createProductFull,
    onSuccess: ({ product }) => {
      const requests = buildFollowUpRequests(form, ctx, product.variants ?? [])
      const toRun = followUpParts(requests)

      if (!toRun.length) {
        finish(product)
        return
      }

      setCreated({ product, requests })
      runParts(toRun, product.id, requests)
    },
    onError: (err: Error) => {
      setFormError(err.message || "Failed to create the product")
      topRef.current?.scrollIntoView({ behavior: "smooth" })
    },
  })

  const locked = isCreating || !!created

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    if (locked) {
      return
    }

    const result = buildCreateProductFullPayload(form, ctx)

    if (result.errors) {
      setErrors(result.errors)
      setFormError(
        "Some fields need attention before the product can be saved."
      )
      topRef.current?.scrollIntoView({ behavior: "smooth" })
      return
    }

    setErrors({})
    setFormError(null)
    create(result.payload)
  }

  const update = (changes: Partial<AddProductForm>) =>
    setForm((prev) => ({ ...prev, ...changes }))

  const updateVariant = (key: string, row: VariantFormRow) =>
    setForm((prev) => ({ ...prev, variants: { ...prev.variants, [key]: row } }))

  const updateOption = (option: OptionFormRow) =>
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((item) =>
        item.key === option.key ? option : item
      ),
    }))

  const addMediaAssets = (added: AdminMediaAsset[]) => {
    setAssets((prev) => ({
      ...prev,
      ...Object.fromEntries(added.map((asset) => [asset.id, asset])),
    }))
    setForm((prev) => ({
      ...prev,
      media_ids: addMedia(
        prev.media_ids,
        added.map((asset) => asset.id)
      ),
    }))
  }

  const essentials = [
    storeQuery,
    locationsQuery,
    definitionsQuery,
    presetsQuery,
  ]
  const loadError = essentials.find((query) => query.isError)?.error

  if (loadError) {
    return (
      <Container
        role="alert"
        className="flex flex-col items-center gap-y-3 px-6 py-12"
      >
        <Text size="small" leading="compact" weight="plus">
          The page could not be loaded
        </Text>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          {loadError.message || "Unexpected error"}
        </Text>
        <Button
          size="small"
          variant="secondary"
          onClick={() => essentials.forEach((query) => query.refetch())}
        >
          Retry
        </Button>
      </Container>
    )
  }

  if (essentials.some((query) => query.isLoading)) {
    return (
      <Container className="flex items-center justify-center px-6 py-12">
        <Spinner
          className="text-ui-fg-subtle animate-spin"
          aria-label="Loading"
        />
      </Container>
    )
  }

  const defaultRow = form.variants[DEFAULT_VARIANT_KEY] ?? emptyVariantRow()

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-y-3">
      <div ref={topRef} />
      <Container className="flex items-center justify-between gap-x-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Heading>Add product</Heading>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Everything about a new product on one page.
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <Button size="small" variant="secondary" type="button" asChild>
            <Link to="/products">Cancel</Link>
          </Button>
          <Button
            size="small"
            type="submit"
            isLoading={isCreating}
            disabled={locked}
          >
            Save
          </Button>
        </div>
      </Container>
      {formError && !created && (
        <Container role="alert" className="px-6 py-4">
          <Text size="small" leading="compact" className="text-ui-fg-error">
            {formError}
          </Text>
        </Container>
      )}
      {created && (
        <SaveStatus
          product={created.product}
          parts={parts}
          onRetry={(part) =>
            runParts([part], created.product.id, created.requests)
          }
        />
      )}
      <fieldset
        disabled={locked}
        className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div className="flex flex-col gap-y-3">
          <GeneralSection
            title={form.title}
            description={form.description}
            errors={errors}
            disabled={locked}
            onChange={update}
          />
          <MediaSection
            mediaIds={form.media_ids}
            thumbnailId={form.thumbnail_id}
            assets={assets}
            disabled={locked}
            onAdd={addMediaAssets}
            onRemove={(id) =>
              setForm((prev) => ({ ...prev, ...removeMedia(prev, id) }))
            }
            onSetThumbnail={(id) => update({ thumbnail_id: id })}
          />
          {isSingleVariant && (
            <Section title="Pricing" testId="add-product-pricing">
              <PricingFields
                variantKey={DEFAULT_VARIANT_KEY}
                row={defaultRow}
                onChange={(row) => updateVariant(DEFAULT_VARIANT_KEY, row)}
                errors={errors}
                disabled={locked}
                currencyCode={currencyCode}
              />
            </Section>
          )}
          <Section title="Inventory" testId="add-product-inventory">
            <div className="flex items-center gap-x-2">
              <Checkbox
                id="product-track-inventory"
                checked={form.track_inventory}
                onCheckedChange={(checked) =>
                  update({ track_inventory: checked === true })
                }
                disabled={locked}
              />
              <Label htmlFor="product-track-inventory" size="small">
                Track quantity
              </Label>
            </div>
            {isSingleVariant ? (
              <InventoryFields
                variantKey={DEFAULT_VARIANT_KEY}
                row={defaultRow}
                onChange={(row) => updateVariant(DEFAULT_VARIANT_KEY, row)}
                errors={errors}
                disabled={locked}
                locations={locations}
                trackInventory={form.track_inventory}
              />
            ) : (
              <Text
                size="small"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                SKU, barcode and quantities are set per variant, below.
              </Text>
            )}
          </Section>
          <VariantsSection
            options={form.options}
            combinations={combinations}
            variants={form.variants}
            errors={errors}
            currencyCode={currencyCode}
            locations={locations}
            trackInventory={form.track_inventory}
            disabled={locked}
            onAddOption={() =>
              update({
                options: [
                  ...form.options,
                  { key: `${nextOptionKey++}`, title: "", values: "" },
                ],
              })
            }
            onChangeOption={updateOption}
            onRemoveOption={(key) =>
              update({
                options: form.options.filter((option) => option.key !== key),
              })
            }
            onChangeVariant={updateVariant}
          />
          <ShippingSection
            shipping={form.shipping}
            presets={presetsQuery.data ?? []}
            shippingProfiles={shippingProfiles}
            errors={errors}
            disabled={locked}
            onChange={(changes) =>
              setForm((prev) => ({
                ...prev,
                shipping: { ...prev.shipping, ...changes },
              }))
            }
          />
          {metafieldFields.length > 0 && (
            <MetafieldsSection
              fields={metafieldFields}
              inputs={form.metafields}
              errors={errors}
              disabled={locked}
              onChange={(key, value) =>
                setForm((prev) => ({
                  ...prev,
                  metafields: { ...prev.metafields, [key]: value },
                }))
              }
            />
          )}
          <SeoSection
            seo={form.seo}
            handle={form.handle}
            product={form}
            disabled={locked}
            onChange={update}
          />
        </div>
        <div className="flex flex-col gap-y-3">
          <OrganizationSections
            form={form}
            options={{
              salesChannels,
              categories,
              types,
              brands,
              collections,
              tags,
            }}
            disabled={locked}
            onChange={(changes) => {
              if (changes.sales_channel_ids) {
                salesChannelsTouched.current = true
              }
              update(changes)
            }}
          />
        </div>
      </fieldset>
    </form>
  )
}

export const config = defineRouteConfig({
  label: "Add product",
  nested: "/products",
})

export default AddProductPage
