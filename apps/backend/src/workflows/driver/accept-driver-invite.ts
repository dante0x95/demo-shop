import {
  acquireLockStep,
  releaseLockStep,
  setAuthAppMetadataStep,
} from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { markDriverInviteAcceptedStep } from "./steps/mark-driver-invite-accepted"
import { setDriverPasswordStep } from "./steps/set-driver-password"
import { validateDriverInviteTokenStep } from "./steps/validate-driver-invite-token"
import {
  DRIVER_INVITE_LOCK_TIMEOUT_SECONDS,
  DRIVER_INVITE_LOCK_TTL_SECONDS,
  driverInviteLockKey,
} from "./utils/driver-invite"

export type AcceptDriverInviteWorkflowInput = {
  token: string
  password: string
}

// The driver sets a password from the emailed link: their emailpass login is
// created (or given that password) and linked to the driver, so logging in
// afterwards carries actor_id = driver.id.
export const acceptDriverInviteWorkflow = createWorkflow(
  "accept-driver-invite",
  function (input: AcceptDriverInviteWorkflowInput) {
    // Finds the driver behind the token, so its invitation can be locked.
    const found = validateDriverInviteTokenStep({ token: input.token })

    const lockKey = transform({ found }, ({ found }) =>
      driverInviteLockKey(found.driver.id)
    )

    // Resend takes the same lock, so a link can't be replaced while it is
    // being accepted.
    acquireLockStep({
      key: lockKey,
      timeout: DRIVER_INVITE_LOCK_TIMEOUT_SECONDS,
      ttl: DRIVER_INVITE_LOCK_TTL_SECONDS,
    })

    // Checked again under the lock: a resend or another acceptance may have
    // finished while this request waited.
    const invite = validateDriverInviteTokenStep({ token: input.token }).config(
      { name: "revalidate-driver-invite-token" }
    )

    markDriverInviteAcceptedStep({ id: invite.invite_id })

    const passwordInput = transform({ input, invite }, ({ input, invite }) => ({
      email: invite.driver.email,
      password: input.password,
    }))

    const login = setDriverPasswordStep(passwordInput)

    setAuthAppMetadataStep({
      authIdentityId: login.auth_identity_id,
      actorType: "driver",
      value: invite.driver.id,
    })

    releaseLockStep({ key: lockKey })

    const driver = transform({ invite }, ({ invite }) => invite.driver)

    return new WorkflowResponse(driver)
  }
)
