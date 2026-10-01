import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaContainer } from "@medusajs/framework/types"

type AdminCredentials = {
  email?: string
  password?: string
}

const decodeJwtPayload = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))

// Creates an admin user through the same flows the dashboard invite uses
// (register identity -> create user account -> log in) and returns auth headers.
export const createAdminUser = async (
  api: any,
  container: MedusaContainer,
  { email = "admin@test.com", password = "supersecret" }: AdminCredentials = {}
) => {
  const registerRes = await api.post("/auth/user/emailpass/register", {
    email,
    password,
  })

  const { auth_identity_id } = decodeJwtPayload(registerRes.data.token)

  await createUserAccountWorkflow(container).run({
    input: {
      authIdentityId: auth_identity_id,
      userData: { email },
    },
  })

  const loginRes = await api.post("/auth/user/emailpass", { email, password })

  return {
    headers: { authorization: `Bearer ${loginRes.data.token}` },
  }
}
