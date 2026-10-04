import { MedusaError, serializeError } from "@medusajs/framework/utils"
import {
  driverInviteAcceptedError,
  driverInviteGoneError,
  driverInviteNotFoundError,
  driverInvitePendingError,
} from "../../../workflows/driver/utils/driver-invite"
import { emailUsedByAnotherAccountError } from "../../../workflows/driver/utils/driver-login"
import { getDriverInviteErrorResponse } from "../invite-error-response"

describe("getDriverInviteErrorResponse", () => {
  it("answers an expired link with 410 and its message", () => {
    expect(getDriverInviteErrorResponse(driverInviteGoneError("expired"))).toEqual({
      status: 410,
      body: {
        type: MedusaError.Types.NOT_ALLOWED,
        message:
          "This invitation link has expired. Ask the store for a new invitation.",
      },
    })
  })

  it("answers a revoked or replaced link with 410", () => {
    expect(
      getDriverInviteErrorResponse(driverInviteGoneError("revoked"))?.status
    ).toBe(410)
  })

  it("answers an accepted invitation with 409, keeping the message", () => {
    expect(getDriverInviteErrorResponse(driverInviteAcceptedError())).toEqual({
      status: 409,
      body: {
        type: MedusaError.Types.CONFLICT,
        message:
          "This invitation was already accepted. Log in with your email and password.",
      },
    })
  })

  it("answers an email used by another role with 409, keeping the message", () => {
    expect(getDriverInviteErrorResponse(emailUsedByAnotherAccountError())).toEqual({
      status: 409,
      body: {
        type: MedusaError.Types.CONFLICT,
        message: "This email is already used by another account",
      },
    })
  })

  it("maps errors as the workflow engine rethrows them (serialized)", () => {
    expect(
      getDriverInviteErrorResponse(serializeError(driverInviteGoneError("expired")))
        ?.status
    ).toBe(410)
    expect(
      getDriverInviteErrorResponse(serializeError(driverInviteAcceptedError()))
        ?.status
    ).toBe(409)
  })

  it.each([
    ["a 404 unknown link", driverInviteNotFoundError()],
    ["a 403 pending invitation", driverInvitePendingError()],
    ["a 400", new MedusaError(MedusaError.Types.INVALID_DATA, "bad")],
    ["a plain Error", new Error("boom")],
    ["undefined", undefined],
    ["null", null],
  ])("leaves %s to Medusa's error handler", (_, error) => {
    expect(getDriverInviteErrorResponse(error)).toBeUndefined()
  })
})
