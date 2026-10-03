import { APIRequestContext, expect, Page, test } from "@playwright/test"

// Smallest valid files: the upload API checks each type's file signature.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)
const GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
)

type TestFile = { name: string; mimeType: string; buffer: Buffer }

const unique = (label: string) =>
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const png = (name: string): TestFile => ({
  name: `${name}.png`,
  mimeType: "image/png",
  buffer: PNG,
})

const gif = (name: string): TestFile => ({
  name: `${name}.gif`,
  mimeType: "image/gif",
  buffer: GIF,
})

const uploadViaApi = async (
  request: APIRequestContext,
  file: TestFile,
  alt?: string
) => {
  const res = await request.post("/admin/media", {
    multipart: { files: file, ...(alt ? { alt } : {}) },
  })
  expect(res.status()).toBe(200)
  return (await res.json()).media_assets[0]
}

const listViaApi = async (
  request: APIRequestContext,
  params: Record<string, string | number>
) => {
  const res = await request.get("/admin/media", { params })
  expect(res.status()).toBe(200)
  return res.json()
}

const rowFor = (page: Page, filename: string) =>
  page.getByRole("row").filter({ hasText: filename })

const search = async (page: Page, value: string) => {
  const listed = page.waitForResponse(
    (res) =>
      res.url().includes("/admin/media?") &&
      new URL(res.url()).searchParams.get("q") === value
  )
  await page.getByPlaceholder("Search filename or alt text").fill(value)
  await listed
}

const openUploadModal = async (page: Page) => {
  await page.goto("/app/media")
  await page.getByRole("button", { name: "Upload" }).click()
  const modal = page.getByRole("dialog")
  await expect(modal.getByRole("heading", { name: "Upload media" })).toBeVisible()
  return modal
}

test.describe("Admin media library page", () => {
  test("is reachable from the sidebar and lists media", async ({ page }) => {
    const name = unique("sidebar")
    const asset = await uploadViaApi(page.request, png(name), "Sidebar alt")

    await page.goto("/app")
    await page.getByRole("link", { name: "Media" }).click()

    await expect(page).toHaveURL(/\/app\/media$/)
    await expect(page.getByRole("heading", { name: "Media" })).toBeVisible()
    for (const header of ["Preview", "Filename", "Alt text", "Type", "Size", "Uploaded"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible()
    }

    const row = rowFor(page, `${name}.png`)
    await expect(row).toContainText("Sidebar alt")
    await expect(row).toContainText("PNG")
    await expect(row).toContainText(`${PNG.length} B`)
    await expect(row.locator("img")).toHaveAttribute("alt", "Sidebar alt")
    await expect(row.locator("img")).toHaveAttribute("src", asset.url)
  })

  test("uploads several files with alt text", async ({ page }) => {
    const first = png(unique("upload-a"))
    const second = gif(unique("upload-b"))
    const modal = await openUploadModal(page)

    await modal.locator("#media-files").setInputFiles([first, second])
    await expect(modal.getByText(first.name)).toBeVisible()
    await expect(modal.getByText(second.name)).toBeVisible()
    await modal.getByLabel(`Alt text for ${first.name}`).fill("  First alt  ")

    const uploaded = page.waitForResponse(
      (res) =>
        res.url().endsWith("/admin/media") && res.request().method() === "POST"
    )
    await modal.getByRole("button", { name: "Upload", exact: true }).click()
    const response = await uploaded
    expect(response.status()).toBe(200)
    const { media_assets } = await response.json()

    await expect(page.getByText("2 files uploaded")).toBeVisible()
    await expect(modal).toBeHidden()
    await expect(rowFor(page, first.name)).toContainText("First alt")
    await expect(rowFor(page, second.name)).toContainText("GIF")

    // Persisted with the alt matched by index; an empty alt is null.
    expect(media_assets).toEqual([
      expect.objectContaining({ filename: first.name, alt: "First alt", mime_type: "image/png" }),
      expect.objectContaining({ filename: second.name, alt: null, mime_type: "image/gif" }),
    ])

    // Survives a reload, so the rows come from the server.
    await page.reload()
    await expect(rowFor(page, first.name)).toBeVisible()
    await expect(rowFor(page, second.name)).toBeVisible()
  })

  test("removes a selected file before uploading", async ({ page }) => {
    const kept = png(unique("kept"))
    const removed = png(unique("removed"))
    const modal = await openUploadModal(page)

    await modal.locator("#media-files").setInputFiles([kept, removed])
    await modal.getByRole("button", { name: `Remove ${removed.name}` }).click()
    await expect(modal.getByText(removed.name)).toBeHidden()

    await modal.getByRole("button", { name: "Upload", exact: true }).click()

    await expect(page.getByText(`"${kept.name}" uploaded`)).toBeVisible()
    const { count } = await listViaApi(page.request, { q: removed.name })
    expect(count).toBe(0)
  })

  test("asks for a file when none is selected", async ({ page }) => {
    const modal = await openUploadModal(page)

    await modal.getByRole("button", { name: "Upload", exact: true }).click()

    await expect(modal.getByText("Select at least one file to upload")).toBeVisible()
    await expect(modal).toBeVisible()
  })

  test("shows the API error for a file that is not an image", async ({ page }) => {
    const fake: TestFile = {
      name: `${unique("fake")}.png`,
      mimeType: "image/png",
      buffer: Buffer.from("not really a png"),
    }
    const apiRes = await page.request.post("/admin/media", {
      multipart: { files: fake },
    })
    expect(apiRes.status()).toBe(400)
    const { message } = await apiRes.json()

    const modal = await openUploadModal(page)
    await modal.locator("#media-files").setInputFiles([fake])
    await modal.getByRole("button", { name: "Upload", exact: true }).click()

    await expect(modal.getByText(message)).toBeVisible()
    await expect(modal).toBeVisible()
  })

  test("searches by filename and alt text", async ({ page }) => {
    const tag = unique("search")
    const byName = png(`${tag}-name`)
    const byAlt = png(unique("other"))
    const unrelated = png(unique("unrelated"))
    await uploadViaApi(page.request, byName)
    await uploadViaApi(page.request, byAlt, `Alt ${tag}`)
    await uploadViaApi(page.request, unrelated)

    await page.goto("/app/media")
    await expect(rowFor(page, unrelated.name)).toBeVisible()
    await search(page, tag)

    await expect(rowFor(page, byName.name)).toBeVisible()
    await expect(rowFor(page, byAlt.name)).toBeVisible()
    await expect(rowFor(page, unrelated.name)).toHaveCount(0)
    await expect(page.getByRole("row")).toHaveCount(3)
  })

  test("filters by type", async ({ page }) => {
    const tag = unique("type")
    const pngFile = png(`${tag}-a`)
    const gifFile = gif(`${tag}-b`)
    await uploadViaApi(page.request, pngFile)
    await uploadViaApi(page.request, gifFile)

    await page.goto("/app/media")
    await search(page, tag)
    await expect(page.getByRole("row")).toHaveCount(3)

    const filtered = page.waitForResponse(
      (res) =>
        res.url().includes("/admin/media?") &&
        new URL(res.url()).searchParams.get("mime_type") === "image/gif"
    )
    await page.getByRole("combobox", { name: "Type" }).click()
    await page.getByRole("option", { name: "GIF" }).click()
    await filtered

    await expect(rowFor(page, gifFile.name)).toBeVisible()
    await expect(rowFor(page, pngFile.name)).toHaveCount(0)

    await page.getByRole("combobox", { name: "Type" }).click()
    await page.getByRole("option", { name: "All types" }).click()
    await expect(rowFor(page, pngFile.name)).toBeVisible()
  })

  test("deletes media after confirming", async ({ page }) => {
    const file = png(unique("delete"))
    const asset = await uploadViaApi(page.request, file)

    await page.goto("/app/media")
    await rowFor(page, file.name).getByRole("button").click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    const prompt = page.getByRole("alertdialog")
    await expect(prompt.getByText("Delete media?")).toBeVisible()
    await prompt.getByRole("button", { name: "Delete" }).click()

    await expect(page.getByText(`"${file.name}" deleted`)).toBeVisible()
    await expect(rowFor(page, file.name)).toHaveCount(0)

    const { media_assets } = await listViaApi(page.request, { q: file.name })
    expect(media_assets.map((a: { id: string }) => a.id)).not.toContain(asset.id)
  })

  test("keeps media when the delete is cancelled", async ({ page }) => {
    const file = png(unique("cancel"))
    await uploadViaApi(page.request, file)

    await page.goto("/app/media")
    await rowFor(page, file.name).getByRole("button").click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click()

    await expect(page.getByRole("alertdialog")).toBeHidden()
    await expect(rowFor(page, file.name)).toBeVisible()
    const { count } = await listViaApi(page.request, { q: file.name })
    expect(count).toBe(1)
  })

  test("shows the API conflict when the media is used by a product", async ({
    page,
  }) => {
    const file = png(unique("in-use"))
    const asset = await uploadViaApi(page.request, file)
    const productTitle = unique("Product")
    const productRes = await page.request.post("/admin/products", {
      data: {
        title: productTitle,
        thumbnail: asset.url,
        options: [{ title: "Size", values: ["M"] }],
      },
    })
    expect(productRes.status()).toBe(200)

    const apiRes = await page.request.delete(`/admin/media/${asset.id}`)
    expect(apiRes.status()).toBe(409)
    const { message } = await apiRes.json()
    expect(message).toContain("is used by 1 product(s)")

    await page.goto("/app/media")
    await rowFor(page, file.name).getByRole("button").click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()

    await expect(page.getByText(message)).toBeVisible()
    await expect(rowFor(page, file.name)).toBeVisible()
  })

  test("paginates 20 media per page, newest first", async ({ page }) => {
    const tag = unique("page")
    const files = Array.from({ length: 21 }, (_, i) =>
      png(`${tag}-${String(i + 1).padStart(2, "0")}`)
    )

    // Sequential so the upload order is the created_at order.
    for (const file of files) {
      await uploadViaApi(page.request, file)
    }

    await page.goto("/app/media")
    await search(page, tag)

    // Newest first: files 21..02 fill page 1, file 01 moves to page 2.
    await expect(page.getByRole("row")).toHaveCount(21)
    await expect(page.getByRole("row").nth(1)).toContainText(files[20].name)
    await expect(rowFor(page, files[0].name)).toHaveCount(0)

    await page.getByRole("button", { name: "Next" }).click()

    await expect(page.getByRole("row")).toHaveCount(2)
    await expect(page.getByRole("row").nth(1)).toContainText(files[0].name)
  })

  test("goes back a page after deleting the only media on the last page", async ({
    page,
  }) => {
    const tag = unique("last-page")
    const files = Array.from({ length: 21 }, (_, i) =>
      png(`${tag}-${String(i + 1).padStart(2, "0")}`)
    )

    for (const file of files) {
      await uploadViaApi(page.request, file)
    }

    await page.goto("/app/media")
    await search(page, tag)
    await page.getByRole("button", { name: "Next" }).click()
    await expect(page.getByRole("row")).toHaveCount(2)

    await rowFor(page, files[0].name).getByRole("button").click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
    await expect(page.getByText(`"${files[0].name}" deleted`)).toBeVisible()

    // Page 2 no longer exists, so the page shows page 1 with the other 20.
    await expect(page.getByRole("row")).toHaveCount(21)
    await expect(page.getByRole("row").nth(1)).toContainText(files[20].name)
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  test("shows an error with a retry when the list fails to load", async ({
    page,
  }) => {
    const file = png(unique("retry"))
    await uploadViaApi(page.request, file)

    const listRequest = /\/admin\/media\?/
    await page.route(listRequest, (route) =>
      route.fulfill({
        status: 500,
        json: { type: "unknown_error", message: "Media storage is unavailable" },
      })
    )

    await page.goto("/app/media")

    const alert = page.getByRole("alert")
    await expect(alert).toContainText("The media library could not be loaded")
    await expect(alert).toContainText("Media storage is unavailable")
    await expect(page.getByRole("table")).toHaveCount(0)

    await page.unroute(listRequest)
    await alert.getByRole("button", { name: "Retry" }).click()

    await expect(page.getByRole("alert")).toHaveCount(0)
    await expect(rowFor(page, file.name)).toBeVisible()
  })
})

test.describe("Admin media library page without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("redirects to login", async ({ page }) => {
    await page.goto("/app/media")

    await expect(page).toHaveURL(/\/app\/login/)
  })
})
