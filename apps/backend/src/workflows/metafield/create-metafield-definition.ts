import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import {
  createMetafieldDefinitionStep,
  CreateMetafieldDefinitionStepInput,
} from "./steps/create-metafield-definition"
import { validateMetafieldDefinitionStep } from "./steps/validate-metafield-definition"
import { metafieldLockInput } from "./utils/lock"

export type CreateMetafieldDefinitionWorkflowInput =
  CreateMetafieldDefinitionStepInput

export const createMetafieldDefinitionWorkflow = createWorkflow(
  "create-metafield-definition",
  function (input: CreateMetafieldDefinitionWorkflowInput) {
    // No value of this key can be saved between the reconnect check and the
    // insert.
    const lock = transform({ input }, ({ input }, context) =>
      metafieldLockInput(input.owner_type, [input.key], context.context.transactionId!)
    )

    acquireLockStep(lock)

    validateMetafieldDefinitionStep(input)

    const metafieldDefinition = createMetafieldDefinitionStep(input)

    releaseLockStep(lock)

    return new WorkflowResponse(metafieldDefinition)
  }
)
