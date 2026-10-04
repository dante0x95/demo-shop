import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { storefrontCompareAtAmount } from "../../../modules/variant-pricing/utils/variant-pricing"
import {
  retrieveDefaultCurrencyCode,
  retrieveVariantBasePrices,
  retrieveVariantPriceDetails,
} from "../../utils/variant-pricing"

type VariantBody = { id?: unknown; [key: string]: unknown }

type ProductBody = { variants?: unknown; [key: string]: unknown }

type ResponseBody = {
  product?: ProductBody
  products?: ProductBody[]
  variant?: VariantBody
  variants?: VariantBody[]
}

const asVariants = (value: unknown): VariantBody[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is VariantBody => !!item && typeof item === "object"
      )
    : []

// The variants in a store response: a product's or products' variants, or
// the variants of the product-variants routes.
export const collectResponseVariants = (body: ResponseBody): VariantBody[] => {
  const products = [
    ...(Array.isArray(body?.products) ? body.products : []),
    ...(body?.product ? [body.product] : []),
  ]

  return [
    ...products.flatMap((product) => asVariants(product?.variants)),
    ...asVariants(body?.variants),
    ...asVariants(body?.variant ? [body.variant] : []),
  ]
}

// Sets `compare_at_amount` on each variant: the compare-at price the admin
// set when it is strictly higher than the variant's price, else null. The
// cost per item is never added (admin-only).
export const addCompareAtToVariants = async (
  req: MedusaRequest,
  variants: VariantBody[]
) => {
  const ids = [
    ...new Set(
      variants
        .map((variant) => variant.id)
        .filter((id): id is string => typeof id === "string")
    ),
  ]

  if (!ids.length) {
    return
  }

  const details = await retrieveVariantPriceDetails(req.scope, ids)
  const withCompareAt = ids.filter(
    (id) => details.get(id)?.compare_at_amount != null
  )

  // Only variants with a compare-at price need their price looked up.
  const prices = withCompareAt.length
    ? await retrieveVariantBasePrices(
        req.scope,
        withCompareAt,
        await retrieveDefaultCurrencyCode(req.scope)
      )
    : new Map<string, number | null>()

  for (const variant of variants) {
    const id = typeof variant.id === "string" ? variant.id : undefined

    if (!id) {
      continue
    }

    variant.compare_at_amount = storefrontCompareAtAmount(
      details.get(id)?.compare_at_amount,
      prices.get(id)
    )
  }
}

// Core store routes can't be extended with computed fields, so this
// middleware wraps `res.json`: once the route sends its products or
// variants, their compare-at prices are added before the body goes out.
// Error responses pass through.
export const withVariantCompareAt = () => {
  return (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    const json = res.json.bind(res)

    res.json = ((body: ResponseBody) => {
      res.json = json

      const variants = collectResponseVariants(body)

      if (res.statusCode >= 400 || !variants.length) {
        return json(body)
      }

      addCompareAtToVariants(req, variants)
        .then(() => json(body))
        .catch(next)

      return res
    }) as MedusaResponse["json"]

    next()
  }
}
