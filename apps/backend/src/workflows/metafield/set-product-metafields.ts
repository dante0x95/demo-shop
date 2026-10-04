import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { prepareMetafieldValuesStep } from "./steps/prepare-metafield-values"
import { upsertMetafieldValuesStep } from "./steps/upsert-metafield-values"
import { metafieldLockInput } from "./utils/lock"

export const PRODUCT_OWNER_TYPE = "product"

export type SetProductMetafieldsWorkflowInput = {
  product_id: string
  metafields: { key: string; value: unknown }[]
}

// Sets some of a product's metafield values; the keys left out keep theirs.
export const setProductMetafieldsWorkflow = createWorkflow(
  "set-product-metafields",
  function (input: SetProductMetafieldsWorkflowInput) {
    // Unknown or deleted product -> 404 before anything is stored.
    useQueryGraphStep({
      entity: "product",
      fields: ["id"],
      filters: { id: input.product_id },
      options: { throwIfKeyNotFound: true },
    })

    const owner = transform({ input }, ({ input }) => ({
      owner_type: PRODUCT_OWNER_TYPE,
      owner_id: input.product_id,
    }))

    // The definitions the values are checked against can't change before
    // the values are saved.
    const lock = transform({ input }, ({ input }, context) =>
      metafieldLockInput(
        PRODUCT_OWNER_TYPE,
        input.metafields.map((metafield) => metafield.key),
        context.context.transactionId!
      )
    )

    acquireLockStep(lock)

    const values = prepareMetafieldValuesStep(
      transform({ input, owner }, ({ input, owner }) => ({
        ...owner,
        metafields: input.metafields,
      }))
    )

    upsertMetafieldValuesStep(
      transform({ owner, values }, ({ owner, values }) => ({
        ...owner,
        values,
      }))
    )

    releaseLockStep(lock)

    return new WorkflowResponse(input.product_id)
  }
)
