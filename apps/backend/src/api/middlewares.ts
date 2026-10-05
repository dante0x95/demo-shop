import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { adminDriverRoutesMiddlewares } from './admin/drivers/middlewares'
import { adminOrderRoutesMiddlewares } from './admin/orders/middlewares'
import { adminProductSeoRoutesMiddlewares } from './admin/products/[id]/seo/middlewares'
import { adminVariantPricingRoutesMiddlewares } from './admin/products/[id]/variant-pricing/middlewares'
import { adminProductFullRoutesMiddlewares } from './admin/products/full/middlewares'
import { authDriverRoutesMiddlewares } from './auth/middlewares'
import { driverRoutesMiddlewares } from './drivers/middlewares'
import { storeProductSeoMiddlewares } from './store/products/middlewares'
import { storeVariantCompareAtMiddlewares } from './store/variant-pricing/middlewares'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    ...adminDriverRoutesMiddlewares,
    ...adminOrderRoutesMiddlewares,
    ...adminProductFullRoutesMiddlewares,
    ...adminProductSeoRoutesMiddlewares,
    ...adminVariantPricingRoutesMiddlewares,
    ...authDriverRoutesMiddlewares,
    ...driverRoutesMiddlewares,
    ...storeProductSeoMiddlewares,
    ...storeVariantCompareAtMiddlewares,
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
  ],
})
