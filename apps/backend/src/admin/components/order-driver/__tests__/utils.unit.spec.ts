import { DELIVERY_STATUS_BADGES, orderDeliveryStatus } from "../utils"

describe("orderDeliveryStatus", () => {
  it("is pending when the order has no fulfillments yet", () => {
    expect(orderDeliveryStatus([])).toBe("pending")
  })

  it("is pending when the fulfillments are missing from the response", () => {
    expect(orderDeliveryStatus(null)).toBe("pending")
    expect(orderDeliveryStatus(undefined)).toBe("pending")
  })

  it("is pending while no fulfillment has been delivered", () => {
    expect(
      orderDeliveryStatus([{ delivered_at: null }, { delivered_at: null }])
    ).toBe("pending")
  })

  it("is delivered once a fulfillment has a delivery date", () => {
    expect(
      orderDeliveryStatus([{ delivered_at: "2026-10-01T12:00:00.000Z" }])
    ).toBe("delivered")
  })

  it("is delivered when one of several fulfillments was delivered (same rule as assign-driver)", () => {
    expect(
      orderDeliveryStatus([
        { delivered_at: null },
        { delivered_at: "2026-10-01T12:00:00.000Z" },
      ])
    ).toBe("delivered")
  })

  it("ignores null entries in the fulfillment list", () => {
    expect(
      orderDeliveryStatus([
        null,
        { delivered_at: "2026-10-01T12:00:00.000Z" },
      ])
    ).toBe("delivered")
  })
})

describe("DELIVERY_STATUS_BADGES", () => {
  it("shows a pending delivery in orange", () => {
    expect(DELIVERY_STATUS_BADGES.pending).toEqual({
      label: "Pending delivery",
      color: "orange",
    })
  })

  it("shows a delivered order in green", () => {
    expect(DELIVERY_STATUS_BADGES.delivered).toEqual({
      label: "Delivered",
      color: "green",
    })
  })
})
