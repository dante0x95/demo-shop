import Medusa from "@medusajs/js-sdk"

// This bundle is built with the plugin, so the shop's backend URL comes from
// the admin build that includes it (`__BACKEND_URL__`); same origin otherwise.
const backendUrl =
  typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__
    ? __BACKEND_URL__
    : "/"

export const sdk = new Medusa({
  baseUrl: backendUrl,
  auth: {
    type: "session",
  },
})
