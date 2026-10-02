import {
  createApiKeysWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { MedusaContainer } from "@medusajs/framework/types"

// Creates a publishable API key, optionally scoped to sales channels, and
// returns the header store routes require.
export const createPublishableKeyHeaders = async (
  container: MedusaContainer,
  salesChannelIds: string[] = []
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

  if (salesChannelIds.length) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: apiKey.id, add: salesChannelIds },
    })
  }

  return {
    headers: { "x-publishable-api-key": apiKey.token },
  }
}
