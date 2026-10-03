import {
  AuthenticationInput,
  IAuthModuleService,
} from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type SetDriverPasswordStepInput = {
  email: string
  password: string
}

export type SetDriverPasswordStepOutput = {
  auth_identity_id: string
}

type CompensationData =
  | { created_auth_identity_id: string }
  | {
      provider_identity_id: string
      previous_provider_metadata: Record<string, unknown> | null
    }

export const driverLoginExistsError = () =>
  new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    "This email already has a driver login"
  )

// Gives the invited driver an emailpass login with the chosen password.
// No identity for the email: register one. An identity that exists but has no
// driver (e.g. a sign-up that stopped at "email taken", or the same person's
// admin or customer login): set its password, as a password reset would; the
// emailed token proves the email is theirs.
export const setDriverPasswordStep = createStep(
  "set-driver-password",
  async ({ email, password }: SetDriverPasswordStepInput, { container }) => {
    const authModuleService: IAuthModuleService = container.resolve(
      Modules.AUTH
    )

    const [existing] = await authModuleService.listProviderIdentities(
      { provider: "emailpass", entity_id: email },
      { relations: ["auth_identity"], take: 1 }
    )

    if (!existing) {
      const { success, authIdentity, error } = await authModuleService.register(
        "emailpass",
        { body: { email, password } } as AuthenticationInput
      )

      if (!success || !authIdentity) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          error ?? "Could not create the driver login"
        )
      }

      return new StepResponse<SetDriverPasswordStepOutput, CompensationData>(
        { auth_identity_id: authIdentity.id },
        { created_auth_identity_id: authIdentity.id }
      )
    }

    if (existing.auth_identity?.app_metadata?.driver_id) {
      throw driverLoginExistsError()
    }

    const authIdentityId = existing.auth_identity?.id ?? existing.auth_identity_id

    if (!authIdentityId) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "The login for this email has no auth identity"
      )
    }

    const { success, error } = await authModuleService.updateProvider(
      "emailpass",
      { entity_id: email, password }
    )

    if (!success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        error ?? "Could not set the driver password"
      )
    }

    return new StepResponse<SetDriverPasswordStepOutput, CompensationData>(
      { auth_identity_id: authIdentityId },
      {
        provider_identity_id: existing.id,
        previous_provider_metadata: existing.provider_metadata ?? null,
      }
    )
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }

    const authModuleService: IAuthModuleService = container.resolve(
      Modules.AUTH
    )

    if ("created_auth_identity_id" in compensation) {
      await authModuleService.deleteAuthIdentities([
        compensation.created_auth_identity_id,
      ])
      return
    }

    await authModuleService.updateProviderIdentities({
      id: compensation.provider_identity_id,
      provider_metadata: compensation.previous_provider_metadata ?? undefined,
    })
  }
)
