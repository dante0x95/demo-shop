import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createMetafieldDefinitionStep,
  CreateMetafieldDefinitionStepInput,
} from "./steps/create-metafield-definition"
import { validateMetafieldDefinitionStep } from "./steps/validate-metafield-definition"

export type CreateMetafieldDefinitionWorkflowInput =
  CreateMetafieldDefinitionStepInput

export const createMetafieldDefinitionWorkflow = createWorkflow(
  "create-metafield-definition",
  function (input: CreateMetafieldDefinitionWorkflowInput) {
    validateMetafieldDefinitionStep(input)

    const metafieldDefinition = createMetafieldDefinitionStep(input)

    return new WorkflowResponse(metafieldDefinition)
  }
)
