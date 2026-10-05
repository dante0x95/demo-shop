# @dante0x95/medusa-plugin-metafield

Metafield definitions and values for Medusa v2 (Shopify-style).

- `metafield` module (`metafield_definition` and `metafield_value` tables).
- Admin routes: `/admin/metafield-definitions`, `/admin/metafields` (config and unstructured
  values), `/admin/products/:id/metafields`.
- Store route: `GET /store/products/:id/metafields?keys=` (only definitions with storefront
  access).
- Admin UI: Metafields settings page and a product-page widget.

## Install

```ts
// medusa-config.ts
plugins: [
  {
    resolve: "@dante0x95/medusa-plugin-metafield",
    options: {
      owner_types: ["product"], // entities a definition can target (default)
    },
  },
]
```

Then run `npx medusa db:migrate`.

## Develop

`npm run build` (`medusa plugin:build`) writes `.medusa/server`, which is what a Medusa app loads.
In this monorepo the shop app builds every plugin before `build`, `dev`, `test:integration:http`
and `test:e2e`, and runs the plugins' unit and module tests with its own Jest config.
