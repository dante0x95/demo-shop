import { defineMiddlewares } from "@medusajs/framework/http"
import { adminMetafieldDefinitionRoutesMiddlewares } from "./admin/metafield-definitions/middlewares"
import { adminMetafieldRoutesMiddlewares } from "./admin/metafields/middlewares"
import { adminProductMetafieldRoutesMiddlewares } from "./admin/products/[id]/metafields/middlewares"
import { storeProductMetafieldRoutesMiddlewares } from "./store/products/[id]/metafields/middlewares"

export default defineMiddlewares({
  routes: [
    ...adminMetafieldDefinitionRoutesMiddlewares,
    ...adminMetafieldRoutesMiddlewares,
    ...adminProductMetafieldRoutesMiddlewares,
    ...storeProductMetafieldRoutesMiddlewares,
  ],
})
