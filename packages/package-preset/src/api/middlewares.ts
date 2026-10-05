import { defineMiddlewares } from "@medusajs/framework/http"
import {
  adminPackagePresetRoutesMiddlewares,
  adminProductPackagePresetMiddlewares,
} from "./admin/package-presets/middlewares"

export default defineMiddlewares({
  routes: [
    ...adminPackagePresetRoutesMiddlewares,
    ...adminProductPackagePresetMiddlewares,
  ],
})
