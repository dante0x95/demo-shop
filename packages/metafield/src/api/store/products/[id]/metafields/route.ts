import { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { resolveStorefrontMetafields } from "../../../../../modules/metafield/utils/values"
import { PRODUCT_OWNER_TYPE } from "../../../../../workflows/metafield/set-product-metafields"
import { StoreGetProductMetafieldsParamsType } from "./validators"

// Every requested key comes back; one without a value, with an empty value,
// without a definition or whose definition is private is null.
export const GET = async (
  req: MedusaStoreRequest<unknown, StoreGetProductMetafieldsParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { keys } = req.validatedQuery

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { ...req.filterableFields, id: req.params.id },
  })

  // The sales channel filter narrows `id` to the key's products; an empty
  // list means the product is not in any of its channels.
  const visibleIds = (req.filterableFields as Record<string, unknown>).id

  if (
    !product ||
    (Array.isArray(visibleIds) && !visibleIds.includes(product.id))
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${req.params.id} was not found`
    )
  }

  const [{ data: definitions }, { data: values }] = await Promise.all([
    query.graph({
      entity: "metafield_definition",
      fields: ["key", "type", "storefront_access"],
      filters: { owner_type: PRODUCT_OWNER_TYPE, key: keys },
    }),
    query.graph({
      entity: "metafield_value",
      fields: ["key", "type", "value"],
      filters: {
        owner_type: PRODUCT_OWNER_TYPE,
        owner_id: product.id,
        key: keys,
      },
    }),
  ])

  res.json({
    metafields: resolveStorefrontMetafields(keys, definitions, values),
  })
}
