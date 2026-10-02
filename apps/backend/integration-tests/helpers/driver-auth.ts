type DriverCredentials = {
  email?: string
  password?: string
}

export const decodeJwtPayload = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))

export const bearer = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
})

export const defaultDriverBody = {
  first_name: "Ana",
  last_name: "Lopez",
  phone: "+52 55 1234 5678",
  vehicle_type: "motorcycle",
}

// Step 1 of driver sign-up: creates the emailpass identity and returns its
// registration token (no driver attached yet).
export const registerDriverIdentity = async (
  api: any,
  { email = "driver@test.com", password = "supersecret" }: DriverCredentials = {}
): Promise<string> => {
  const res = await api.post("/auth/driver/emailpass/register", {
    email,
    password,
  })

  return res.data.token
}

// Full sign-up (register -> POST /drivers -> login). Returns the driver and
// auth headers of a logged-in driver.
export const createDriver = async (
  api: any,
  {
    email = "driver@test.com",
    password = "supersecret",
    body = {},
  }: DriverCredentials & { body?: Record<string, unknown> } = {}
) => {
  const registrationToken = await registerDriverIdentity(api, {
    email,
    password,
  })

  const driverRes = await api.post(
    "/drivers",
    { ...defaultDriverBody, ...body },
    bearer(registrationToken)
  )

  const loginRes = await api.post("/auth/driver/emailpass", { email, password })

  return {
    driver: driverRes.data.driver,
    headers: bearer(loginRes.data.token).headers,
  }
}
