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

// The only way to get a new link (T14.2: no driver self-service). Sends a new
// invitation and revokes the pending one, or marks it expired if its window
// had passed. Also works for drivers created before invitations existed.
// No lock: issueDriverInvite serializes resends on the driver's row, and an
// acceptance racing it loses or wins on one conditional update.
export const resendDriverInviteWorkflow = createWorkflow(
  "resend-driver-invite",
  function (input: ResendDriverInviteWorkflowInput) {
    const { data: driver } = useQueryGraphStep({
      entity: "driver",
      fields: ["id", "email", "first_name", "invites.status"],
      filters: { id: input.driver_id },
      options: { isList: false, throwIfKeyNotFound: true },
    })

    validateDriverWithoutLoginStep({ driver })

    const invite = sendDriverInviteWorkflow.runAsStep({ input: { driver } })

    return new WorkflowResponse(invite)
  }
)
