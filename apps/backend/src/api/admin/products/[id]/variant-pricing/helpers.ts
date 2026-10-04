import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import {
  findBasePriceAmount,
  VariantPrice,
} from "../../../../../modules/variant-pricing/utils/variant-pricing"
import {
  retrieveDefaultCurrencyCode,
  retrieveVariantPriceDetails,
  VARIANT_PRICE_FIELDS,
} from "../../../../utils/variant-pricing"

export type AdminVariantPricingVariant = {
  variant_id: string
  title: string
  sku: string | null
  // The variant's own price in the default currency, null when it has none.
  price: number | null
  // What the admin set; null = not set.
  compare_at_amount: number | null
  cost_amount: number | null
}

export type AdminVariantPricing = {
  product_id: string
  // The store's default currency, which every amount is in.
  currency_code: string | null
  variants: AdminVariantPricingVariant[]
}

export const retrieveAdminVariantPricing = async (
  scope: MedusaContainer,
  productId: string
): Promise<AdminVariantPricing> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.variant_rank",
      "variants.created_at",
      ...VARIANT_PRICE_FIELDS.map((field) => `variants.${field}`),
    ],
    filters: { id: productId },
  })

  if (!product) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${productId} was not found`
    )
  }

  // The order the admin shows them in.
  const variants = (product.variants ?? [])
    .filter((variant) => !!variant)
    .sort(
      (a, b) =>
        (a.variant_rank ?? 0) - (b.variant_rank ?? 0) ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
        a.id.localeCompare(b.id)
    )

  const [currencyCode, details] = await Promise.all([
    retrieveDefaultCurrencyCode(scope),
    retrieveVariantPriceDetails(
      scope,
      variants.map((variant) => variant.id)
    ),
  ])

  return {
    product_id: product.id,
    currency_code: currencyCode,
    variants: variants.map((variant) => {
      const detail = details.get(variant.id)

      return {
        variant_id: variant.id,
        title: variant.title,
        sku: variant.sku ?? null,
        price: findBasePriceAmount(
          (variant as { prices?: VariantPrice[] }).prices,
          currencyCode
        ),
        compare_at_amount: detail?.compare_at_amount ?? null,
        cost_amount: detail?.cost_amount ?? null,
      }
    }),
  }
}
