import { CreateDriverFormState, toCreateDriverPayload } from "../utils"

const filledForm: CreateDriverFormState = {
  first_name: "Ana",
  last_name: "Pérez",
  email: "ana@example.com",
  phone: "+54 11 5555 0000",
  vehicle_type: "motorcycle",
  license_plate: "AB 123 CD",
  is_active: true,
}

describe("toCreateDriverPayload", () => {
  it("sends every field of a filled form", () => {
    expect(toCreateDriverPayload(filledForm)).toEqual({
      first_name: "Ana",
      last_name: "Pérez",
      email: "ana@example.com",
      phone: "+54 11 5555 0000",
      vehicle_type: "motorcycle",
      license_plate: "AB 123 CD",
      is_active: true,
    })
  })

  it("omits a blank license plate, which the API would reject", () => {
    const payload = toCreateDriverPayload({ ...filledForm, license_plate: "" })

    expect(payload).not.toHaveProperty("license_plate")
  })

  it("omits a whitespace-only license plate", () => {
    const payload = toCreateDriverPayload({
      ...filledForm,
      license_plate: "   ",
    })

    expect(payload).not.toHaveProperty("license_plate")
  })

  it("trims the license plate it sends", () => {
    const payload = toCreateDriverPayload({
      ...filledForm,
      license_plate: "  AB 123 CD ",
    })

    expect(payload.license_plate).toBe("AB 123 CD")
  })

  it("omits an unselected vehicle type so the API's 400 names it", () => {
    const payload = toCreateDriverPayload({ ...filledForm, vehicle_type: "" })

    expect(payload).not.toHaveProperty("vehicle_type")
  })

  it("trims surrounding spaces from the email", () => {
    const payload = toCreateDriverPayload({
      ...filledForm,
      email: "  ana@example.com ",
    })

    expect(payload.email).toBe("ana@example.com")
  })

  it("sends empty required fields as typed so the API reports them", () => {
    const payload = toCreateDriverPayload({
      ...filledForm,
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
    })

    expect(payload).toMatchObject({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
    })
  })

  it("always sends is_active, including false", () => {
    expect(
      toCreateDriverPayload({ ...filledForm, is_active: false }).is_active
    ).toBe(false)
  })
})
