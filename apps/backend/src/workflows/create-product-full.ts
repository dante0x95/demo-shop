import {
  CreateProductVariantWorkflowInputDTO,
  CreateProductWorkflowInputDTO,
} from "@medusajs/framework/types"
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { validateProductFullReferencesStep } from "./steps/validate-product-full-references"

export type ProductFullStockInput = {
  location_id: string
  quantity: number
}

export type ProductFullVariantInput = Omit<
  CreateProductVariantWorkflowInputDTO,
  "inventory_items"
> & {
  stock?: ProductFullStockInput[]
}

export type CreateProductFullWorkflowInput = {
  product: Omit<
    CreateProductWorkflowInputDTO,
    "images" | "thumbnail" | "variants"
  > & {
    // Media asset ids, in display order.
    images?: string[]
    // One of `images`; the first image when omitted.
    thumbnail_id?: string
    variants?: ProductFullVariantInput[]
  }
  additional_data?: Record<string, unknown>
}

// Creates a product with its options, priced variants, stock per location,
// brand (via the `productsCreated` hook) and images from the media library,
// all or nothing: the nested core workflows compensate if a later step fails.
export const createProductFullWorkflow = createWorkflow(
  "create-product-full",
  function (input: CreateProductFullWorkflowInput) {
    const references = transform({ input }, ({ input }) => ({
      media_asset_ids: [
        ...(input.product.images ?? []),
        ...(input.product.thumbnail_id ? [input.product.thumbnail_id] : []),
      ],
      location_ids: (input.product.variants ?? []).flatMap((variant) =>
        (variant.stock ?? []).map((stock) => stock.location_id)
      ),
    }))

    const mediaUrls = validateProductFullReferencesStep(references)

    // Images and thumbnail keep the asset's url, which is what T07's in-use
    // check looks for before a media asset can be deleted.
    const productInput = transform(
      { input, mediaUrls },
      ({ input, mediaUrls }): CreateProductWorkflowInputDTO => {
        const { images = [], thumbnail_id, variants, ...product } =
          input.product
        const thumbnailId = thumbnail_id ?? images[0]

        return {
          ...product,
          images: images.map((id) => ({ url: mediaUrls[id] })),
          thumbnail: thumbnailId ? mediaUrls[thumbnailId] : undefined,
          variants: variants?.map(({ stock, ...variant }) => variant),
        }
      }
    )

    const createdProducts = createProductsWorkflow.runAsStep({
      input: transform({ input, productInput }, ({ input, productInput }) => ({
        products: [productInput],
        additional_data: input.additional_data,
      })),
    })

    const variantIds = transform({ createdProducts }, ({ createdProducts }) =>
      (createdProducts[0].variants ?? []).map((variant) => variant.id)
    )

    const { data: variants } = useQueryGraphStep({
      entity: "product_variant",
      fields: ["id", "inventory_items.inventory_item_id"],
      filters: { id: variantIds },
    })

    // Created variants come back in input order, the same mapping core
    // `createProductVariantsWorkflow` relies on for their inventory items.
    const inventoryLevels = transform(
      { input, variantIds, variants },
      ({ input, variantIds, variants }) =>
        (input.product.variants ?? []).flatMap((variantInput, index) => {
          const variant = variants.find(({ id }) => id === variantIds[index])
          const inventoryItemId =
            variant?.inventory_items?.[0]?.inventory_item_id

          return (variantInput.stock ?? []).map((stock) => ({
            inventory_item_id: inventoryItemId as string,
            location_id: stock.location_id,
            stocked_quantity: stock.quantity,
          }))
        })
    )

    when({ inventoryLevels }, ({ inventoryLevels }) => !!inventoryLevels.length)
      .then(() => {
        createInventoryLevelsWorkflow.runAsStep({
          input: { inventory_levels: inventoryLevels },
        })
      })

    const product = transform(
      { createdProducts },
      ({ createdProducts }) => createdProducts[0]
    )

    return new WorkflowResponse(product)
  }
)
