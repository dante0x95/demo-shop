# @dante0x95/medusa-plugin-package-preset

Package presets for Medusa v2: the box a product ships in when shipped alone.

- `packagePreset` module (`package_preset` table, at most one default) and a
  `product ↔ package_preset` link (a product has at most one preset, enforced by the
  `product-package-preset-unique-product` migration script).
- Admin routes: `GET/POST /admin/package-presets`, `GET/DELETE /admin/package-presets/:id`,
  `POST /admin/package-presets/:id/set-default`, `GET/POST /admin/products/:id/package-preset`
  (none set = the default preset).
- Admin UI: Package presets settings page and a product-page widget.

## Install

```ts
// medusa-config.ts
plugins: ["@dante0x95/medusa-plugin-package-preset"]
```

Then run `npx medusa db:migrate`. No options.

## Develop

`npm run build` (`medusa plugin:build`) writes `.medusa/server`, which is what a Medusa app loads.
In this monorepo the shop app builds every plugin before `build`, `dev`, `test:integration:http`
and `test:e2e`, and runs the plugins' unit and module tests with its own Jest config.
