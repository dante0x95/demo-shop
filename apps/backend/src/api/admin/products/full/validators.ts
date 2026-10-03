import { z } from "@medusajs/framework/zod"
import {
  CreateProduct,
  CreateProductVariant,
} from "@medusajs/medusa/api/admin/products/validators"
import { createSelectParams } from "@medusajs/medusa/api/utils/validators"

export const AdminGetProductFullParams = createSelectParams()

const ProductFullStock = z.strictObject({
  location_id: z.string().trim().min(1),
  quantity: z.number().int().min(0),
})

// Core variant fields, with stock per location instead of `inventory_items`:
// each variant gets its own inventory item, as in core product creation.
const ProductFullVariant = z
  .strictObject({
    ...CreateProductVariant.omit({ inventory_items: true }).shape,
    stock: z.array(ProductFullStock).optional(),
  })
  .superRefine((variant, ctx) => {
    if (!variant.stock?.length) {
      return
    }

    if (variant.manage_inventory === false) {
      ctx.addIssue({
        code: "custom",
        path: ["stock"],
        message: "stock requires manage_inventory to be true",
      })
    }

    const locationIds = variant.stock.map((stock) => stock.location_id)

    if (new Set(locationIds).size !== locationIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["stock"],
        message: "Each location can appear only once in stock",
      })
    }
  })

// Core product fields, with images picked from the media library by id
// instead of urls.
export const AdminCreateProductFull = z
  .strictObject({
    ...CreateProduct.omit({ images: true, thumbnail: true, variants: true })
      .shape,
    images: z
      .array(z.string().trim().min(1))
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Each media asset can appear only once in images",
      })
      .optional(),
    thumbnail_id: z.string().trim().min(1).optional(),
    variants: z.array(ProductFullVariant).optional(),
    additional_data: z
      .strictObject({
        brand_id: z.string().trim().min(1).optional(),
      })
      .nullish(),
  })
  .superRefine((product, ctx) => {
    if (product.thumbnail_id && !product.images?.includes(product.thumbnail_id)) {
      ctx.addIssue({
        code: "custom",
        path: ["thumbnail_id"],
        message: "thumbnail_id must be one of images",
      })
    }
  })

export type AdminCreateProductFullType = z.infer<typeof AdminCreateProductFull>
