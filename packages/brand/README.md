# @dante0x95/medusa-plugin-brand

Brands for Medusa v2 products.

- `brand` module (`brand` table) and a `product ↔ brand` link (a product has at most one brand,
  enforced by the `product-brand-unique-product` migration script).
- Admin routes: `GET/POST /admin/brands`, `GET/POST/DELETE /admin/brands/:id`. Core
  `POST /admin/products` accepts `additional_data.brand_id` (linked by a `productsCreated` hook).
- Store routes: `GET /store/brands`, `GET /store/brands/:id/products?region_id=`.
- Admin UI: Brands list, create and detail pages.

## Install

```ts
// medusa-config.ts
plugins: ["@dante0x95/medusa-plugin-brand"]
```

Then run `npx medusa db:migrate`. No options.

## Develop

`npm run build` (`medusa plugin:build`) writes `.medusa/server`, which is what a Medusa app loads.
In this monorepo the shop app builds every plugin before `build`, `dev`, `test:integration:http`
and `test:e2e`, and runs the plugins' unit and module tests with its own Jest config.
