import { configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { adminBrandRoutesMiddlewares } from './admin/brands/middlewares'
import { adminMediaRoutesMiddlewares } from './admin/media/middlewares'
import { adminMetafieldDefinitionRoutesMiddlewares } from './admin/metafield-definitions/middlewares'
import { adminOrderRoutesMiddlewares } from './admin/orders/middlewares'
import { adminProductFullRoutesMiddlewares } from './admin/products/full/middlewares'
import { driverRoutesMiddlewares } from './drivers/middlewares'
import { storeBrandRoutesMiddlewares } from './store/brands/middlewares'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    ...adminBrandRoutesMiddlewares,
    ...adminMediaRoutesMiddlewares,
    ...adminMetafieldDefinitionRoutesMiddlewares,
    ...adminOrderRoutesMiddlewares,
    ...adminProductFullRoutesMiddlewares,
    ...driverRoutesMiddlewares,
    ...storeBrandRoutesMiddlewares,
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
