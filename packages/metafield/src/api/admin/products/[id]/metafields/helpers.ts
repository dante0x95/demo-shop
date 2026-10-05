import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { toAdminMetafields } from "../../../../../modules/metafield/utils/values"
import { PRODUCT_OWNER_TYPE } from "../../../../../workflows/metafield/set-product-metafields"

// Every value the product has, with its definition when there is one.
export const retrieveAdminProductMetafields = async (
  scope: MedusaContainer,
  productId: string
) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { id: productId },
  })

  if (!product) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${productId} was not found`
    )
  }

  const { data: values } = await query.graph({
    entity: "metafield_value",
    fields: ["id", "key", "type", "value", "created_at", "updated_at"],
    filters: { owner_type: PRODUCT_OWNER_TYPE, owner_id: productId },
  })

  if (!values.length) {
    return []
  }

  const { data: definitions } = await query.graph({
    entity: "metafield_definition",
    fields: ["id", "key", "label", "type", "options", "storefront_access"],
    filters: {
      owner_type: PRODUCT_OWNER_TYPE,
      key: values.map((value) => value.key),
    },
  })

  return toAdminMetafields(values, definitions)
}
