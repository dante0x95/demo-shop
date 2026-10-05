# @dante0x95/medusa-plugin-media

Media library for Medusa v2.

- `media` module (`media_asset` table).
- Admin routes: `POST /admin/media` (multipart upload), `GET /admin/media`,
  `DELETE /admin/media/:id` (409 while a product, product thumbnail or variant thumbnail uses the
  asset's url), `GET /admin/media/config`.
- Admin UI: Media library page (browse, search, filter by type, upload, delete).

## Install

```ts
// medusa-config.ts
plugins: [
  {
    resolve: "@dante0x95/medusa-plugin-media",
    options: {
      max_file_size: 5 * 1024 * 1024, // bytes per file
      max_files: 10, // files per request
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
    },
  },
]
```

Every option is optional; the values above are the defaults. Then run `npx medusa db:migrate`.

## Develop

`npm run build` (`medusa plugin:build`) writes `.medusa/server`, which is what a Medusa app loads.
In this monorepo the shop app builds every plugin before `build`, `dev`, `test:integration:http`
and `test:e2e`, and runs the plugins' unit and module tests with its own Jest config.
