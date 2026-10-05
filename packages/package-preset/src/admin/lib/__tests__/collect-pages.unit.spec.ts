import { collectPages } from "../collect-pages"

// A list served page by page, recording each request.
const pagedList = (all: string[], countOverride?: number) => {
  const requests: { offset: number; limit: number }[] = []

  const fetchPage = async (offset: number, limit: number) => {
    requests.push({ offset, limit })
    return {
      items: all.slice(offset, offset + limit),
      count: countOverride ?? all.length,
    }
  }

  return { fetchPage, requests }
}

describe("collectPages", () => {
  it("returns a list that fits in one page with a single request", async () => {
    const { fetchPage, requests } = pagedList(["a", "b"])

    await expect(collectPages(fetchPage, 100)).resolves.toEqual(["a", "b"])
    expect(requests).toEqual([{ offset: 0, limit: 100 }])
  })

  it("reads every page, in order, until it has them all", async () => {
    const { fetchPage, requests } = pagedList(["a", "b", "c", "d", "e"])

    await expect(collectPages(fetchPage, 2)).resolves.toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ])
    expect(requests).toEqual([
      { offset: 0, limit: 2 },
      { offset: 2, limit: 2 },
      { offset: 4, limit: 2 },
    ])
  })

  it("stops after the last full page when the count is an exact multiple", async () => {
    const { fetchPage, requests } = pagedList(["a", "b", "c", "d"])

    await expect(collectPages(fetchPage, 2)).resolves.toEqual([
      "a",
      "b",
      "c",
      "d",
    ])
    expect(requests).toHaveLength(2)
  })

  it("returns an empty list with one request when there is nothing", async () => {
    const { fetchPage, requests } = pagedList([])

    await expect(collectPages(fetchPage, 100)).resolves.toEqual([])
    expect(requests).toHaveLength(1)
  })

  it("stops at an empty page when the list shrank below its count", async () => {
    // The count says 10, but only 3 items are left by the time it is read.
    const { fetchPage, requests } = pagedList(["a", "b", "c"], 10)

    await expect(collectPages(fetchPage, 2)).resolves.toEqual(["a", "b", "c"])
    // The next page starts after the items already read.
    expect(requests).toEqual([
      { offset: 0, limit: 2 },
      { offset: 2, limit: 2 },
      { offset: 3, limit: 2 },
    ])
  })

  it("rejects with the page's error when a page fails", async () => {
    let calls = 0
    const fetchPage = async (offset: number) => {
      calls += 1
      if (offset > 0) {
        throw new Error("Presets are unavailable")
      }
      return { items: ["a", "b"], count: 4 }
    }

    await expect(collectPages(fetchPage, 2)).rejects.toThrow(
      "Presets are unavailable"
    )
    expect(calls).toBe(2)
  })
})
