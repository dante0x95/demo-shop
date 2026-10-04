import { setAuthAppMetadataStep } from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { markDriverInviteAcceptedStep } from "./steps/mark-driver-invite-accepted"
import { setDriverPasswordStep } from "./steps/set-driver-password"
import { validateDriverInviteTokenStep } from "./steps/validate-driver-invite-token"

export type AcceptDriverInviteWorkflowInput = {
  token: string
  password: string
}

// The driver sets a password from the emailed link: their emailpass login is
// created (or taken over, if no role uses it) and linked to the driver, so
// logging in afterwards carries actor_id = driver.id.
// No lock (T14.2): claiming the invitation is one conditional update, so a
// resend or a second acceptance racing this one can't both succeed.
export const acceptDriverInviteWorkflow = createWorkflow(
  "accept-driver-invite",
  function (input: AcceptDriverInviteWorkflowInput) {
    const invite = validateDriverInviteTokenStep({ token: input.token })

    markDriverInviteAcceptedStep({ id: invite.invite_id })

    const passwordInput = transform({ input, invite }, ({ input, invite }) => ({
      driver_id: invite.driver.id,
      email: invite.driver.email,
      password: input.password,
    }))

    const login = setDriverPasswordStep(passwordInput)

    setAuthAppMetadataStep({
      authIdentityId: login.auth_identity_id,
      actorType: "driver",
      value: invite.driver.id,
    })

    const driver = transform({ invite }, ({ invite }) => invite.driver)

    return new WorkflowResponse(driver)
  }
)
