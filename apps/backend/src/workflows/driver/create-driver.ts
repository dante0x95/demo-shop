import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createDriverStep, CreateDriverStepInput } from "./steps/create-driver"
import { validateDriverEmailUniqueStep } from "./steps/validate-driver-email-unique"

export type CreateDriverWorkflowInput = CreateDriverStepInput

// Admin-side creation: only the driver record. No auth identity is created,
// so the driver has no login until one is linked to it.
export const createDriverWorkflow = createWorkflow(
  "create-driver",
  function (input: CreateDriverWorkflowInput) {
    validateDriverEmailUniqueStep({ email: input.email })

    const driver = createDriverStep(input)

    return new WorkflowResponse(driver)
  }
)
