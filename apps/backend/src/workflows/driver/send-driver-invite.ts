import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { issueDriverInviteStep } from "./steps/issue-driver-invite"
import {
  buildDriverInviteUrl,
  DRIVER_INVITE_NOTIFICATION_CHANNEL,
  DRIVER_INVITE_NOTIFICATION_TEMPLATE,
} from "./utils/driver-invite"

export type SendDriverInviteWorkflowInput = {
  driver: {
    id: string
    email: string
    first_name: string
  }
}

// Issues a fresh invitation (replacing any previous link) and emails it.
// Used when an admin creates a driver and by resend-invite.
export const sendDriverInviteWorkflow = createWorkflow(
  "send-driver-invite",
  function (input: SendDriverInviteWorkflowInput) {
    const invite = issueDriverInviteStep({ driver_id: input.driver.id })

    const notifications = transform({ input, invite }, ({ input, invite }) => [
      {
        to: input.driver.email,
        channel: DRIVER_INVITE_NOTIFICATION_CHANNEL,
        template: DRIVER_INVITE_NOTIFICATION_TEMPLATE,
        trigger_type: "driver_invite.sent",
        resource_id: input.driver.id,
        resource_type: "driver",
        data: {
          driver_id: input.driver.id,
          first_name: input.driver.first_name,
          token: invite.token,
          invite_url: buildDriverInviteUrl(invite.token),
          expires_at: invite.expires_at,
        },
      },
    ])

    sendNotificationsStep(notifications)

    const result = transform({ invite }, ({ invite }) => ({
      id: invite.invite_id,
      expires_at: invite.expires_at,
    }))

    return new WorkflowResponse(result)
  }
)
