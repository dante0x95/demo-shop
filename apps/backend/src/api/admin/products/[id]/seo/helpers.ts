import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import {
  ResolvedProductSeo,
  resolveProductSeo,
} from "../../../../../modules/seo/utils/product-seo"

export type AdminProductSeo = {
  product_id: string
  // What the admin set; null = not set (the storefront uses the fallback).
  title: string | null
  description: string | null
  // What the storefront renders, fallbacks applied.
  resolved: ResolvedProductSeo
}

export const retrieveAdminProductSeo = async (
  scope: MedusaContainer,
  productId: string
): Promise<AdminProductSeo> => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "description",
      "product_seo_override.title",
      "product_seo_override.description",
    ],
    filters: { id: productId },
  })

  if (!product) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${productId} was not found`
    )
  }

  const seo = product.product_seo_override as
    | { title: string | null; description: string | null }
    | null
    | undefined

  return {
    product_id: product.id,
    title: seo?.title ?? null,
    description: seo?.description ?? null,
    resolved: resolveProductSeo(product, seo),
  }
}
