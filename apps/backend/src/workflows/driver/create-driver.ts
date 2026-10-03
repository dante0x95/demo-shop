import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { sendDriverInviteWorkflow } from "./send-driver-invite"
import { createDriverStep, CreateDriverStepInput } from "./steps/create-driver"
import { validateDriverEmailUniqueStep } from "./steps/validate-driver-email-unique"

export type CreateDriverWorkflowInput = CreateDriverStepInput

// Admin-side creation: the driver record plus an emailed invitation. The
// driver gets a login only when they accept it (accept-driver-invite).
export const createDriverWorkflow = createWorkflow(
  "create-driver",
  function (input: CreateDriverWorkflowInput) {
    validateDriverEmailUniqueStep({ email: input.email })

    const driver = createDriverStep(input)

    sendDriverInviteWorkflow.runAsStep({ input: { driver } })

    return new WorkflowResponse(driver)
  }
)
