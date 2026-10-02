// Minimal content that starts with each type's signature. Enough for the
// media module's checks; not decodable images.
const signatures: Record<string, Buffer> = {
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/gif": Buffer.from("GIF89a", "latin1"),
  "image/webp": Buffer.concat([
    Buffer.from("RIFF", "latin1"),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from("WEBPVP8 ", "latin1"),
  ]),
  "image/avif": Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x1c]),
    Buffer.from("ftypavif", "latin1"),
  ]),
}

export const imageContent = (type: string) =>
  Buffer.concat([signatures[type] ?? Buffer.alloc(0), Buffer.from("body")])

export type UploadFile = {
  name: string
  type: string
  content?: Buffer
}

export const buildMediaForm = (files: UploadFile[], alts: string[] = []) => {
  const form = new FormData()

  for (const file of files) {
    form.append(
      "files",
      new Blob([new Uint8Array(file.content ?? imageContent(file.type))], {
        type: file.type,
      }),
      file.name
    )
  }

  for (const alt of alts) {
    form.append("alt", alt)
  }

  return form
}
