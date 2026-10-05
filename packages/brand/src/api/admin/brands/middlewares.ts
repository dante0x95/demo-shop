import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  listBrandsTransformQueryConfig,
  retrieveBrandDetailTransformQueryConfig,
  retrieveBrandTransformQueryConfig,
} from "./query-config"
import {
  AdminCreateBrand,
  AdminGetBrandParams,
  AdminGetBrandsParams,
  AdminUpdateBrand,
} from "./validators"

export const adminBrandRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/brands",
    middlewares: [
      validateAndTransformQuery(
        AdminGetBrandsParams,
        listBrandsTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/brands",
    middlewares: [
      validateAndTransformBody(AdminCreateBrand),
      validateAndTransformQuery(
        AdminGetBrandParams,
        retrieveBrandTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/brands/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetBrandParams,
        retrieveBrandDetailTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/brands/:id",
    middlewares: [
      validateAndTransformBody(AdminUpdateBrand),
      validateAndTransformQuery(
        AdminGetBrandParams,
        retrieveBrandDetailTransformQueryConfig
      ),
    ],
  },
]

// Core product creation accepts the brand; the `productsCreated` hook
// (src/workflows/brand/hooks/products-created.ts) links it. Kept with the
// brand routes rather than under admin/products because it is brand code.
export const adminProductBrandMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/products",
    additionalDataValidator: {
      brand_id: z.string().trim().min(1).optional(),
    },
  },
]
