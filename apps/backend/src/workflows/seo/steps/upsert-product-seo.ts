import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { SEO_MODULE } from "../../../modules/seo"
import SeoModuleService from "../../../modules/seo/service"
import { normalizeSeoValue } from "../../../modules/seo/utils/product-seo"

export type UpsertProductSeoStepInput = {
  product_id: string
  title?: string | null
  description?: string | null
}

type ProductSeoRow = {
  id: string
  title: string | null
  description: string | null
}

type Compensation =
  | { created_id: string }
  | { previous: ProductSeoRow }

// Saves the fields that were sent; a field left out keeps its stored value.
// The product's first edit creates its row; later edits update it.
export const upsertProductSeoStep = createStep(
  "upsert-product-seo",
  async (input: UpsertProductSeoStepInput, { container }) => {
    const seoModuleService: SeoModuleService = container.resolve(SEO_MODULE)

    const data: { title?: string | null; description?: string | null } = {}
    const title = normalizeSeoValue(input.title)
    const description = normalizeSeoValue(input.description)

    if (title !== undefined) {
      data.title = title
    }

    if (description !== undefined) {
      data.description = description
    }

    const findCurrent = async () => {
      const [current] = await seoModuleService.listProductSeoOverrides(
        { product_id: input.product_id },
        { select: ["id", "title", "description"], take: 1 }
      )

      return current as ProductSeoRow | undefined
    }

    let current = await findCurrent()

    if (!current) {
      try {
        const productSeo = await seoModuleService.createProductSeoOverrides({
          product_id: input.product_id,
          title: null,
          description: null,
          ...data,
        })

        return new StepResponse<typeof productSeo, Compensation>(productSeo, {
          created_id: productSeo.id,
        })
      } catch (error) {
        // A concurrent first edit of the same product created the row after
        // the lookup above; the unique index rejected this one, so update it.
        current = await findCurrent()

        if (!current) {
          throw error
        }
      }
    }

    const productSeo = await seoModuleService.updateProductSeoOverrides({
      id: current.id,
      ...data,
    })

    return new StepResponse<typeof productSeo, Compensation>(productSeo, {
      previous: current,
    })
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }

    const seoModuleService: SeoModuleService = container.resolve(SEO_MODULE)

    if ("created_id" in compensation) {
      await seoModuleService.deleteProductSeoOverrides(compensation.created_id)
      return
    }

    await seoModuleService.updateProductSeoOverrides(compensation.previous)
  }
)
