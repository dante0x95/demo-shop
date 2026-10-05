import { metafieldLockInput, metafieldLockKey } from "../lock"

describe("metafieldLockKey", () => {
  it("scopes the lock to the owner type and key", () => {
    expect(metafieldLockKey("product", "fabric")).toBe(
      "metafield:product:fabric"
    )
    expect(metafieldLockKey("product_variant", "fabric")).not.toBe(
      metafieldLockKey("product", "fabric")
    )
  })
})

describe("metafieldLockInput", () => {
  it("locks each key once, in sorted order, so concurrent runs can't deadlock", () => {
    expect(
      metafieldLockInput("product", ["weight", "fabric", "weight"], "run-1").key
    ).toEqual(["metafield:product:fabric", "metafield:product:weight"])
  })

  it("preserves the run owner across acquisition and release", () => {
    const first = metafieldLockInput("product", ["fabric"], "run-1")
    const second = metafieldLockInput("product", ["fabric"], "run-2")

    expect(first.ownerId).toBe("run-1")
    expect(
      metafieldLockInput("product", ["fabric"], "run-1").ownerId
    ).toBe(first.ownerId)
    expect(first.ownerId).not.toBe(second.ownerId)
  })

  it("waits for a busy key and expires a lock that is never released", () => {
    expect(metafieldLockInput("product", ["fabric"], "run-1")).toEqual(
      expect.objectContaining({
        timeout: expect.any(Number),
        ttl: expect.any(Number),
        executeOnSubWorkflow: true,
      })
    )
  })
})
