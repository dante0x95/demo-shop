import {
  acquireLockStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { sendDriverInviteWorkflow } from "./send-driver-invite"
import { validateDriverWithoutLoginStep } from "./steps/validate-driver-without-login"
import {
  DRIVER_INVITE_LOCK_TIMEOUT_SECONDS,
  DRIVER_INVITE_LOCK_TTL_SECONDS,
  driverInviteLockKey,
} from "./utils/driver-invite"

export type ResendDriverInviteWorkflowInput = {
  driver_id: string
}

// Sends a new invitation link and invalidates the previous one. Also works
// for drivers created before invitations existed (they have none yet).
export const resendDriverInviteWorkflow = createWorkflow(
  "resend-driver-invite",
  function (input: ResendDriverInviteWorkflowInput) {
    const lockKey = transform({ input }, ({ input }) =>
      driverInviteLockKey(input.driver_id)
    )

    // Same lock as accept-driver-invite: the link is never replaced while it
    // is being accepted, and the checks below see any acceptance that won.
    acquireLockStep({
      key: lockKey,
      timeout: DRIVER_INVITE_LOCK_TIMEOUT_SECONDS,
      ttl: DRIVER_INVITE_LOCK_TTL_SECONDS,
    })

    const { data: driver } = useQueryGraphStep({
      entity: "driver",
      fields: ["id", "email", "first_name", "invite.accepted_at"],
      filters: { id: input.driver_id },
      options: { isList: false, throwIfKeyNotFound: true },
    })

    validateDriverWithoutLoginStep({ driver })

    const invite = sendDriverInviteWorkflow.runAsStep({ input: { driver } })

    releaseLockStep({ key: lockKey })

    return new WorkflowResponse(invite)
  }
)
