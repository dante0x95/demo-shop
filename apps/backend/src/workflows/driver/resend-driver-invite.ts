import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { sendDriverInviteWorkflow } from "./send-driver-invite"
import { validateDriverWithoutLoginStep } from "./steps/validate-driver-without-login"

export type ResendDriverInviteWorkflowInput = {
  driver_id: string
}

// Sends a new invitation link and invalidates the previous one. Also works
// for drivers created before invitations existed (they have none yet).
export const resendDriverInviteWorkflow = createWorkflow(
  "resend-driver-invite",
  function (input: ResendDriverInviteWorkflowInput) {
    const { data: driver } = useQueryGraphStep({
      entity: "driver",
      fields: ["id", "email", "first_name", "invite.accepted_at"],
      filters: { id: input.driver_id },
      options: { isList: false, throwIfKeyNotFound: true },
    })

    validateDriverWithoutLoginStep({ driver })

    const invite = sendDriverInviteWorkflow.runAsStep({ input: { driver } })

    return new WorkflowResponse(invite)
  }
)
