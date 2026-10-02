import {
  setAuthAppMetadataStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createDriverStep, CreateDriverStepInput } from "./steps/create-driver"
import { validateDriverAccountStep } from "./steps/validate-driver-account"

export type CreateDriverAccountWorkflowInput = {
  auth_identity_id: string
  driver: Omit<CreateDriverStepInput, "email" | "is_active">
}

// Mirrors the core createCustomerAccountWorkflow: create the actor, then link
// it to the auth identity so later logins carry actor_id = driver.id.
export const createDriverAccountWorkflow = createWorkflow(
  "create-driver-account",
  function (input: CreateDriverAccountWorkflowInput) {
    const { data: authIdentity } = useQueryGraphStep({
      entity: "auth_identity",
      fields: [
        "id",
        "app_metadata",
        "provider_identities.provider",
        "provider_identities.entity_id",
      ],
      filters: { id: input.auth_identity_id },
      options: { isList: false, throwIfKeyNotFound: true },
    })

    const email = validateDriverAccountStep({ auth_identity: authIdentity })

    const driverData = transform({ input, email }, ({ input, email }) => ({
      ...input.driver,
      email,
      is_active: false,
    }))

    const driver = createDriverStep(driverData)

    setAuthAppMetadataStep({
      authIdentityId: input.auth_identity_id,
      actorType: "driver",
      value: driver.id,
    })

    return new WorkflowResponse(driver)
  }
)
