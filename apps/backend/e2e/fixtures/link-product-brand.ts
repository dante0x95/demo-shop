import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { BRAND_MODULE } from "@dante0x95/medusa-plugin-brand/modules/brand"

// Links a product to a brand for E2E specs; there is no HTTP route for it yet (T08).
// Usage: npx medusa exec ./e2e/fixtures/link-product-brand.ts <productId> <brandId>
export default async function linkProductBrand({ container, args }: ExecArgs) {
  const [productId, brandId] = args

  if (!productId || !brandId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Usage: link-product-brand.ts <productId> <brandId>"
    )
  }

  const link = container.resolve(ContainerRegistrationKeys.LINK)

  await link.create({
    [Modules.PRODUCT]: { product_id: productId },
    [BRAND_MODULE]: { brand_id: brandId },
  })
}
