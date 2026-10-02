import { createApiKeysWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaContainer } from "@medusajs/framework/types"

// Creates a publishable API key and returns the header store routes require.
export const createPublishableKeyHeaders = async (
  container: MedusaContainer
) => {
  const {
    result: [apiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        { title: "Test Publishable Key", type: "publishable", created_by: "" },
      ],
    },
  })

  return {
    headers: { "x-publishable-api-key": apiKey.token },
  }
}
