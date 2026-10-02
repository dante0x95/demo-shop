import { hasImageExtension, hasImageSignature } from "../image-types"

const bytes = (...parts: (number[] | string)[]) =>
  Buffer.concat(
    parts.map((part) =>
      typeof part === "string" ? Buffer.from(part, "latin1") : Buffer.from(part)
    )
  )

describe("hasImageExtension", () => {
  it.each([
    ["image/jpeg", "photo.jpg"],
    ["image/jpeg", "photo.JPEG"],
    ["image/png", "my.photo.png"],
    ["image/gif", "a.gif"],
    ["image/webp", "a.webp"],
    ["image/avif", "a.avif"],
  ])("accepts %s with %s", (mimeType, filename) => {
    expect(hasImageExtension(mimeType, filename)).toBe(true)
  })

  it.each([
    ["image/png", "evil.html"],
    ["image/png", "photo.jpg"],
    ["image/png", "png"],
    ["image/png", "photo.png.html"],
    ["image/svg+xml", "logo.svg"],
  ])("rejects %s with %s", (mimeType, filename) => {
    expect(hasImageExtension(mimeType, filename)).toBe(false)
  })
})

describe("hasImageSignature", () => {
  it.each([
    ["image/jpeg", bytes([0xff, 0xd8, 0xff, 0xdb])],
    ["image/png", bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["image/gif", bytes("GIF87a")],
    ["image/gif", bytes("GIF89a")],
    ["image/webp", bytes("RIFF", [0, 0, 0, 0], "WEBP")],
    ["image/avif", bytes([0, 0, 0, 0x1c], "ftypavif")],
    ["image/avif", bytes([0, 0, 0, 0x1c], "ftypavis")],
  ])("accepts a %s header", (mimeType, header) => {
    expect(hasImageSignature(mimeType, header)).toBe(true)
  })

  it.each([
    ["image/png", bytes("<html>")],
    ["image/png", bytes([0xff, 0xd8, 0xff, 0xdb])],
    ["image/jpeg", bytes([])],
    ["image/webp", bytes("RIFF", [0, 0, 0, 0], "WAVE")],
    ["image/avif", bytes([0, 0, 0, 0x1c], "ftypheic")],
    ["image/svg+xml", bytes("<svg>")],
  ])("rejects %s with a mismatched header", (mimeType, header) => {
    expect(hasImageSignature(mimeType, header)).toBe(false)
  })
})
