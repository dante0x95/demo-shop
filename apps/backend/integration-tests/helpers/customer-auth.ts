import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaContainer } from "@medusajs/framework/types"

const decodeJwtPayload = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))

// A storefront customer with an emailpass login, through the same flows as
// customer sign-up (register identity -> create customer account).
export const createCustomerWithLogin = async (
  api: any,
  container: MedusaContainer,
  { email, password = "supersecret" }: { email: string; password?: string }
) => {
  const registerRes = await api.post("/auth/customer/emailpass/register", {
    email,
    password,
  })

  const { auth_identity_id } = decodeJwtPayload(registerRes.data.token)

  const { result: customer } = await createCustomerAccountWorkflow(
    container
  ).run({
    input: { authIdentityId: auth_identity_id, customerData: { email } },
  })

  return customer
}
