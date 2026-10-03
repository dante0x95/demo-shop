import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import {
  adminBrandRoutesMiddlewares,
  adminProductBrandMiddlewares,
} from './admin/brands/middlewares'
import { adminDriverRoutesMiddlewares } from './admin/drivers/middlewares'
import { adminMediaRoutesMiddlewares } from './admin/media/middlewares'
import { adminMetafieldDefinitionRoutesMiddlewares } from './admin/metafield-definitions/middlewares'
import { adminOrderRoutesMiddlewares } from './admin/orders/middlewares'
import { adminPackagePresetRoutesMiddlewares } from './admin/package-presets/middlewares'
import { adminProductSeoRoutesMiddlewares } from './admin/products/[id]/seo/middlewares'
import { adminProductFullRoutesMiddlewares } from './admin/products/full/middlewares'
import { authDriverRoutesMiddlewares } from './auth/middlewares'
import { driverRoutesMiddlewares } from './drivers/middlewares'
import { storeBrandRoutesMiddlewares } from './store/brands/middlewares'
import { storeProductSeoMiddlewares } from './store/products/middlewares'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    ...adminBrandRoutesMiddlewares,
    ...adminDriverRoutesMiddlewares,
    ...adminMediaRoutesMiddlewares,
    ...adminMetafieldDefinitionRoutesMiddlewares,
    ...adminOrderRoutesMiddlewares,
    ...adminPackagePresetRoutesMiddlewares,
    ...adminProductBrandMiddlewares,
    ...adminProductFullRoutesMiddlewares,
    ...adminProductSeoRoutesMiddlewares,
    ...authDriverRoutesMiddlewares,
    ...driverRoutesMiddlewares,
    ...storeBrandRoutesMiddlewares,
    ...storeProductSeoMiddlewares,
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
