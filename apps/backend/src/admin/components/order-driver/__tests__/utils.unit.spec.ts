import {
  assignDriverBlockedReason,
  DELIVERY_STATUS_BADGES,
  orderDeliveryStatus,
} from "../utils"

const DELIVERED = "2026-10-01T12:00:00.000Z"
const CANCELED = "2026-09-30T08:00:00.000Z"

const pending = { delivered_at: null, canceled_at: null }
const delivered = { delivered_at: DELIVERED, canceled_at: null }

describe("orderDeliveryStatus", () => {
  it("is pending when the order has no fulfillments yet", () => {
    expect(orderDeliveryStatus([])).toBe("pending")
  })

  it("is pending when the fulfillments are missing from the response", () => {
    expect(orderDeliveryStatus(null)).toBe("pending")
    expect(orderDeliveryStatus(undefined)).toBe("pending")
  })

  it("is pending while no fulfillment has been delivered", () => {
    expect(orderDeliveryStatus([pending, pending])).toBe("pending")
  })

  it("is delivered when the only fulfillment has a delivery date", () => {
    expect(orderDeliveryStatus([delivered])).toBe("delivered")
  })

  it("is delivered when every fulfillment has a delivery date", () => {
    expect(orderDeliveryStatus([delivered, delivered])).toBe("delivered")
  })

  it("is partial when some fulfillments are delivered and others are not", () => {
    expect(orderDeliveryStatus([pending, delivered])).toBe("partial")
    expect(orderDeliveryStatus([delivered, pending])).toBe("partial")
  })

  it("ignores canceled fulfillments: the rest delivered means delivered", () => {
    expect(
      orderDeliveryStatus([
        delivered,
        { delivered_at: null, canceled_at: CANCELED },
      ])
    ).toBe("delivered")
  })

  it("is pending when the only fulfillment was canceled", () => {
    expect(
      orderDeliveryStatus([{ delivered_at: null, canceled_at: CANCELED }])
    ).toBe("pending")
  })

  it("does not count a canceled fulfillment that has a delivery date", () => {
    expect(
      orderDeliveryStatus([
        pending,
        { delivered_at: DELIVERED, canceled_at: CANCELED },
      ])
    ).toBe("pending")
  })

  it("ignores null entries in the fulfillment list", () => {
    expect(orderDeliveryStatus([null, delivered])).toBe("delivered")
  })
})

describe("DELIVERY_STATUS_BADGES", () => {
  it("shows a pending delivery in orange", () => {
    expect(DELIVERY_STATUS_BADGES.pending).toEqual({
      label: "Pending delivery",
      color: "orange",
    })
  })

  it("shows a partially delivered order in blue", () => {
    expect(DELIVERY_STATUS_BADGES.partial).toEqual({
      label: "Partially delivered",
      color: "blue",
    })
  })

  it("shows a delivered order in green", () => {
    expect(DELIVERY_STATUS_BADGES.delivered).toEqual({
      label: "Delivered",
      color: "green",
    })
  })
})

describe("assignDriverBlockedReason", () => {
  it("allows a pending order without fulfillments", () => {
    expect(
      assignDriverBlockedReason({ status: "pending", fulfillments: [] })
    ).toBeNull()
    expect(
      assignDriverBlockedReason({ status: "pending", fulfillments: null })
    ).toBeNull()
  })

  it("allows an order that requires action", () => {
    expect(
      assignDriverBlockedReason({
        status: "requires_action",
        fulfillments: [pending],
      })
    ).toBeNull()
  })

  it.each(["canceled", "completed", "draft", "archived"])(
    "blocks a %s order and names its status",
    (status) => {
      expect(
        assignDriverBlockedReason({ status, fulfillments: [] })
      ).toContain(status)
    }
  )

  it("blocks a pending order once a fulfillment was delivered", () => {
    expect(
      assignDriverBlockedReason({
        status: "pending",
        fulfillments: [pending, delivered],
      })
    ).toContain("already delivered")
  })

  it("blocks on a delivered fulfillment even if it was canceled, as the API does", () => {
    expect(
      assignDriverBlockedReason({
        status: "pending",
        fulfillments: [{ delivered_at: DELIVERED }],
      })
    ).toContain("already delivered")
  })

  it("reports the status first when the order is both canceled and delivered", () => {
    expect(
      assignDriverBlockedReason({
        status: "canceled",
        fulfillments: [delivered],
      })
    ).toContain("canceled")
  })
})
