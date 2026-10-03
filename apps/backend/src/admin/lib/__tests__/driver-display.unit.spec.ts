import {
  DRIVER_STATUS_FILTERS,
  formatDriverName,
  statusFilterToQuery,
  vehicleTypeLabel,
} from "../driver-display"

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
