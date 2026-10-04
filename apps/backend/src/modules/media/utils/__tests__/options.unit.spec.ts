import {
  DEFAULT_ALLOWED_MIME_TYPES,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_FILES,
  resolveMediaModuleOptions,
} from "../options"

describe("resolveMediaModuleOptions", () => {
  it("applies the defaults", () => {
    expect(resolveMediaModuleOptions()).toEqual({
      max_file_size: DEFAULT_MAX_FILE_SIZE,
      max_files: DEFAULT_MAX_FILES,
      allowed_mime_types: DEFAULT_ALLOWED_MIME_TYPES,
    })
  })

  it("keeps valid overrides", () => {
    expect(
      resolveMediaModuleOptions({
        max_file_size: 1024,
        max_files: 3,
        allowed_mime_types: ["image/png"],
      })
    ).toEqual({
      max_file_size: 1024,
      max_files: 3,
      allowed_mime_types: ["image/png"],
    })
  })

  it("lists each allowed type once, in the configured order", () => {
    expect(
      resolveMediaModuleOptions({
        allowed_mime_types: ["image/webp", "image/png", "image/webp"],
      }).allowed_mime_types
    ).toEqual(["image/webp", "image/png"])
  })

  it("returns a copy of the default type list", () => {
    const resolved = resolveMediaModuleOptions()

    resolved.allowed_mime_types.push("image/svg+xml")

    expect(resolveMediaModuleOptions().allowed_mime_types).toEqual([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/avif",
    ])
  })

  it.each([NaN, 0, -1, 1.5])("rejects max_file_size %s", (value) => {
    expect(() => resolveMediaModuleOptions({ max_file_size: value })).toThrow(
      "max_file_size must be a positive integer"
    )
  })

  it.each([NaN, 0, -1, 1.5])("rejects max_files %s", (value) => {
    expect(() => resolveMediaModuleOptions({ max_files: value })).toThrow(
      "max_files must be a positive integer"
    )
  })

  it("rejects a type the module can't verify", () => {
    expect(() =>
      resolveMediaModuleOptions({
        allowed_mime_types: ["image/png", "image/svg+xml"],
      })
    ).toThrow("received image/svg+xml")
  })

  it("rejects an empty type list", () => {
    expect(() => resolveMediaModuleOptions({ allowed_mime_types: [] })).toThrow(
      "non-empty subset"
    )
  })
})
