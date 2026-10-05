import { defineMiddlewares } from "@medusajs/framework/http"
import {
  adminBrandRoutesMiddlewares,
  adminProductBrandMiddlewares,
} from "./admin/brands/middlewares"
import { storeBrandRoutesMiddlewares } from "./store/brands/middlewares"

export default defineMiddlewares({
  routes: [
    ...adminBrandRoutesMiddlewares,
    ...adminProductBrandMiddlewares,
    ...storeBrandRoutesMiddlewares,
  ],
})
