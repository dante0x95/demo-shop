import {
  CreateDriverFormState,
  DRIVER_STATUS_FILTERS,
  formatDriverName,
  statusFilterToQuery,
  toCreateDriverPayload,
  vehicleTypeLabel,
} from "../utils"

const filledForm: CreateDriverFormState = {
  first_name: "Ana",
  last_name: "Pérez",
  email: "ana@example.com",
  phone: "+54 11 5555 0000",
  vehicle_type: "motorcycle",
  license_plate: "AB 123 CD",
  is_active: true,
}

describe("statusFilterToQuery", () => {
  it("sends no is_active filter for all statuses", () => {
    expect(statusFilterToQuery("all")).toEqual({})
  })

  it("asks for active drivers only", () => {
    expect(statusFilterToQuery("active")).toEqual({ is_active: true })
  })

  it("asks for inactive drivers only (self-registered drivers awaiting approval)", () => {
    expect(statusFilterToQuery("inactive")).toEqual({ is_active: false })
  })

  it("offers all statuses first, then active and inactive", () => {
    expect(DRIVER_STATUS_FILTERS.map((filter) => filter.value)).toEqual([
      "all",
      "active",
      "inactive",
    ])
  })
})

describe("vehicleTypeLabel", () => {
  it.each([
    ["motorcycle", "Motorcycle"],
    ["car", "Car"],
    ["bicycle", "Bicycle"],
  ] as const)("labels %s as %s", (type, label) => {
    expect(vehicleTypeLabel(type)).toBe(label)
  })

  it("falls back to the raw value for a type the UI does not know yet", () => {
    expect(vehicleTypeLabel("van")).toBe("van")
  })

  it("shows an object key such as toString as-is instead of an inherited value", () => {
    expect(vehicleTypeLabel("toString")).toBe("toString")
  })
})

describe("formatDriverName", () => {
  it("joins first and last name", () => {
    expect(formatDriverName({ first_name: "Ana", last_name: "Pérez" })).toBe(
      "Ana Pérez"
    )
  })

  it("does not leave a stray space when one part is empty", () => {
    expect(formatDriverName({ first_name: "Ana", last_name: "" })).toBe("Ana")
    expect(formatDriverName({ first_name: "", last_name: "Pérez" })).toBe(
      "Pérez"
    )
  })
})

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
