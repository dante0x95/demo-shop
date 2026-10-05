import { defineMiddlewares } from "@medusajs/framework/http"
import { adminMediaRoutesMiddlewares } from "./admin/media/middlewares"

export default defineMiddlewares({
  routes: [...adminMediaRoutesMiddlewares],
})
