import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createRemoteLinkStep,
  dismissRemoteLinkStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { planProductPackagePresetLinks } from "./utils/product-package-preset-links"

export type SetProductPackagePresetWorkflowInput = {
  product_id: string
  // null removes the product's preset: the store's default applies again.
  package_preset_id: string | null
}

// Picks the package a product ships in when shipped alone. One preset per
// product, for all its variants; setting the current one again is a no-op.
export const setProductPackagePresetWorkflow = createWorkflow(
  "set-product-package-preset",
  function (input: SetProductPackagePresetWorkflowInput) {
    // Two admins picking a preset for the same product at once must not both
    // read "no preset" and both link one.
    const lockKey = transform(
      { input },
      ({ input }) => `product-package-preset:${input.product_id}`
    )

    acquireLockStep({ key: lockKey, timeout: 2, ttl: 10 })

    // Unknown or deleted product -> 404.
    const { data: product } = useQueryGraphStep({
      entity: "product",
      fields: ["id", "package_preset.id"],
      filters: { id: input.product_id },
      options: { isList: false, throwIfKeyNotFound: true },
    })

    // Unknown or deleted preset -> 404, before any link changes.
    when({ input }, ({ input }) => !!input.package_preset_id).then(() => {
      useQueryGraphStep({
        entity: "package_preset",
        fields: ["id"],
        filters: { id: input.package_preset_id as string },
        options: { isList: false, throwIfKeyNotFound: true },
      }).config({ name: "get-package-preset" })
    })

    const links = transform({ input, product }, ({ input, product }) =>
      planProductPackagePresetLinks({
        productId: input.product_id,
        currentPackagePresetId: product.package_preset?.id ?? null,
        nextPackagePresetId: input.package_preset_id,
      })
    )

    dismissRemoteLinkStep(transform({ links }, ({ links }) => links.dismiss))
    createRemoteLinkStep(transform({ links }, ({ links }) => links.create))

    releaseLockStep({ key: lockKey })

    return new WorkflowResponse({
      product_id: input.product_id,
      package_preset_id: input.package_preset_id,
    })
  }
)
