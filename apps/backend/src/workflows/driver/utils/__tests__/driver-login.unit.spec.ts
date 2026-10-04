import { MedusaError } from "@medusajs/framework/utils"
import {
  emailUsedByAnotherAccountError,
  getDriverLoginOwner,
} from "../driver-login"

describe("getDriverLoginOwner", () => {
  it("treats a login with no role linked as nobody's", () => {
    expect(getDriverLoginOwner({}, "drv_1")).toBe("none")
    expect(getDriverLoginOwner(null, "drv_1")).toBe("none")
    expect(getDriverLoginOwner(undefined)).toBe("none")
  })

  it("ignores keys that don't link a role and empty role links", () => {
    expect(
      getDriverLoginOwner({ locale: "es", user_id: null, customer_id: "" }, "drv_1")
    ).toBe("none")
  })

  it("recognizes the driver's own login", () => {
    expect(getDriverLoginOwner({ driver_id: "drv_1" }, "drv_1")).toBe("driver")
  })

  it.each([
    ["an admin", { user_id: "user_1" }],
    ["a customer", { customer_id: "cus_1" }],
    ["another driver", { driver_id: "drv_2" }],
    ["any other actor type", { vendor_id: "ven_1" }],
  ])("reports a login used by %s as another account's", (_, appMetadata) => {
    expect(getDriverLoginOwner(appMetadata, "drv_1")).toBe("other")
  })

  it("reports a login shared by this driver and another role as another account's", () => {
    expect(
      getDriverLoginOwner({ driver_id: "drv_1", customer_id: "cus_1" }, "drv_1")
    ).toBe("other")
  })

  it("reports any linked role as another account's before the driver exists", () => {
    expect(getDriverLoginOwner({ driver_id: "drv_1" })).toBe("other")
    expect(getDriverLoginOwner({ user_id: "user_1" })).toBe("other")
  })
})

describe("emailUsedByAnotherAccountError", () => {
  it("is a conflict that says the email is taken by another account", () => {
    const error = emailUsedByAnotherAccountError()

    expect(error.type).toBe(MedusaError.Types.CONFLICT)
    expect(error.message).toBe("This email is already used by another account")
  })
})
