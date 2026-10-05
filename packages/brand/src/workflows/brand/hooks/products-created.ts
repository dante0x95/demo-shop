import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { BRAND_MODULE } from "../../../modules/brand"

// Links the created products to `additional_data.brand_id`. Every product
// creation path (core `POST /admin/products`, `create-product-full`) runs
// through this hook, so it is the only place the link is created. Any
// existing brand is accepted, active or not; an unknown or deleted one fails
// the workflow, which rolls the products back.
createProductsWorkflow.hooks.productsCreated(
  async ({ products, additional_data }, { container }) => {
    const brandId = additional_data?.brand_id as string | undefined

    if (!brandId) {
      return new StepResponse(undefined, [])
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data: brands } = await query.graph({
      entity: "brand",
      fields: ["id"],
      filters: { id: brandId },
    })

    if (!brands.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Brand with id: ${brandId} was not found`
      )
    }

    const links = products.map((product) => ({
      [Modules.PRODUCT]: { product_id: product.id },
      [BRAND_MODULE]: { brand_id: brandId },
    }))

    const link = container.resolve(ContainerRegistrationKeys.LINK)

    await link.create(links)

    return new StepResponse(undefined, links)
  },
  async (links, { container }) => {
    if (!links?.length) {
      return
    }

    const link = container.resolve(ContainerRegistrationKeys.LINK)

    await link.dismiss(links)
  }
)
