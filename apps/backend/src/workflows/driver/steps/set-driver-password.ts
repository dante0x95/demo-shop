import {
  AuthenticationInput,
  IAuthModuleService,
} from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { driverHasLoginError } from "../../../modules/driver/utils/errors"
import {
  emailUsedByAnotherAccountError,
  getDriverLoginOwner,
} from "../utils/driver-login"

export type SetDriverPasswordStepInput = {
  driver_id: string
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

// Gives the invited driver an emailpass login with the chosen password.
// No login for the email: register one. A login with no role linked (e.g. a
// sign-up that stopped at "email taken"): take it over and set its password,
// as a password reset would; the emailed token proves the email is theirs.
// A login an admin, a customer or another driver uses: 409 (T14.2, no shared
// logins), checked again here because one may have appeared since the driver
// was created.
export const setDriverPasswordStep = createStep(
  "set-driver-password",
  async (
    { driver_id, email, password }: SetDriverPasswordStepInput,
    { container }
  ) => {
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

    const owner = getDriverLoginOwner(
      existing.auth_identity?.app_metadata,
      driver_id
    )

    if (owner === "other") {
      throw emailUsedByAnotherAccountError()
    }

    if (owner === "driver") {
      throw driverHasLoginError()
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
