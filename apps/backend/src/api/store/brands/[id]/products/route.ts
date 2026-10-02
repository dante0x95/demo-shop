import { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  QueryContext,
} from "@medusajs/framework/utils"
import { HttpTypes } from "@medusajs/framework/types"
import { wrapProductsWithTaxPrices } from "@medusajs/medusa/api/store/products/helpers"
import {
  prepareInventoryQuantityFields,
  wrapVariantsWithInventoryQuantityForSalesChannel,
} from "@medusajs/medusa/api/utils/middlewares/index"
import ProductBrandLink from "../../../../../links/product-brand"
import { StoreGetBrandProductsParamsType } from "../../validators"

export const GET = async (
  req: MedusaStoreRequest<unknown, StoreGetBrandProductsParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { skip = 0, take = 0 } = req.queryConfig.pagination ?? {}

  const {
    data: [brand],
  } = await query.graph({
    entity: "brand",
    fields: ["id"],
    filters: { id: req.params.id, is_active: true },
    withDeleted: false,
  })

  if (!brand) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Brand with id: ${req.params.id} was not found`
    )
  }

  // `id` is always set by the sales channel middleware: the ids of the
  // products in the key's channels. An empty list means none, not "no filter".
  const { id, ...filters } = req.filterableFields as Record<string, unknown>
  const salesChannelProductIds = id as string[]

  const emptyResponse = { products: [], count: 0, offset: skip, limit: take }

  if (!salesChannelProductIds.length) {
    res.json(emptyResponse)
    return
  }

  const { data: links } = await query.graph({
    entity: ProductBrandLink.entryPoint,
    fields: ["product_id"],
    filters: { brand_id: brand.id, product_id: salesChannelProductIds },
  })

  const productIds: string[] = links.map((link) => link.product_id)

  if (!productIds.length) {
    res.json(emptyResponse)
    return
  }

  const { fields, withInventoryQuantity } = prepareInventoryQuantityFields(
    req.queryConfig.fields,
    { relation: "variants" }
  )

  const context: Record<string, unknown> = {}

  if (req.pricingContext) {
    context.variants = {
      calculated_price: QueryContext(req.pricingContext),
    }
  }

  const { data: products, metadata } = await query.graph(
    {
      entity: "product",
      fields,
      filters: { ...filters, id: productIds },
      pagination: req.queryConfig.pagination,
      context,
    },
    { locale: req.locale }
  )

  if (withInventoryQuantity) {
    await wrapVariantsWithInventoryQuantityForSalesChannel(
      req,
      products.flatMap((product) => product.variants ?? [])
    )
  }

  await wrapProductsWithTaxPrices(req, products as HttpTypes.StoreProduct[])

  res.json({
    products,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? skip,
    limit: metadata?.take ?? take,
  })
}
