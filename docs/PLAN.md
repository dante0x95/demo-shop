# PLAN — pendientes.md backlog

One task = one pendientes.md line = one PR. Do them in order; start a task only when its
deps are merged. Prerequisites (module, link, workflow, middleware) ship inside the first
task that needs them. ❓ = decide with Dante at the plan gate.

Status: [ ] todo · [~] in PR · [x] merged

## Phase 1 — Brand (calibration)

### [ ] T01 · GET/POST /admin/brands
Deps: — · Ships: `brand` module (`brand`), `create-brand` workflow, integration test setup
- Nothing exists yet: build the module, workflow and routes from scratch. Once merged,
  this is the reference implementation the other modules mirror.
- ❓ Brand fields beyond `name`.
- Tests: create → 200; missing name → 400; list paginated; no auth → 401.

### [ ] T02 · GET/POST/DELETE /admin/brands/:id
Deps: T01 · Ships: `product ↔ brand` link
- GET returns the brand with linked products. POST is a partial update.
- DELETE via workflow: unlinks products, never deletes them.
- Unknown id → 404 on all three.

### [ ] T03 · GET /store/brands
Deps: T02
- Publishable key required; paginated; public fields only.

### [ ] T04 · GET /store/brands/:id/products
Deps: T03
- Only `published` products in the key's sales channel; paginated.
- Variants with calculated prices for a `region_id` query param (the WhatsApp agent needs prices).

## Phase 2 — Media library

### [ ] T05 · POST /admin/media
Deps: T01 · Ships: `media` module (`media_asset`), multer middleware
- Upload with core `uploadFilesWorkflow`, then create `media_asset` rows
  (url, file_id, mime_type, size, alt).
- If row creation fails, compensation deletes the uploaded files.
- Images only. ❓ Max file size.
- Tests: 2 images → 200; non-image → 400; no auth → 401.

### [ ] T06 · GET /admin/media
Deps: T05
- Paginated, newest first, filters: `q` (alt/filename), `mime_type`.

### [ ] T07 · DELETE /admin/media/:id
Deps: T05
- Delete the record first, the file last (file deletion can't be compensated).
- ❓ Asset in use by a product: block (409) or allow?

## Phase 3 — Shopify-style product creation

### [ ] T08 · POST /admin/products/full
Deps: T02, T05 · Ships: `create-product-full` workflow, `productsCreated` brand hook
- One request: product + options (color/size) + variants with prices + stock per location
  + brand + images (by `media_asset` id).
- Compose core flows (`createProductsWorkflow`, inventory level flows).
- Brand goes through `additional_data.brand_id`, linked by a `productsCreated` hook (validated
  with `additionalDataValidator`). Don't link twice.
- All-or-nothing. Tests: happy path; unknown brand → 400; unknown location → 400 AND no product left behind.

## Phase 4 — Catalog config

### [ ] T09 · GET/POST/DELETE /admin/metafield-definitions
Deps: T01 · Ships: `metafield` module
- key (unique per owner type), label, type (text/number/boolean/select), options, owner type.
- ❓ Where values live: product `metadata` or own table.

### [ ] T10 · GET/POST/DELETE /admin/package-presets
Deps: T01 · Ships: `package-preset` module
- name, length, width, height, weight, units, is_default (only one default).

## Phase 5 — Drivers & delivery

### [ ] T11 · Cash on delivery setup (no endpoint)
Deps: —
- Idempotent script in `src/scripts` enabling `pp_system_default` in the store region.
- Test: running it twice doesn't duplicate.

### [ ] T12 · POST /drivers (registration)
Deps: T01 · Ships: `driver` module, `driver` actor type
- Flow: `POST /auth/driver/emailpass/register` → token → `POST /drivers` (Bearer)
  → workflow creates driver + `setAuthAppMetadataStep`.
- `authenticate("driver", ["session","bearer"], { allowUnregistered: true })` on `POST /drivers` only.
- If `authMethodsPerActor` exists in `medusa-config.ts`, add `driver: ["emailpass"]`.
- Test the full flow end-to-end, including login afterwards.

### [ ] T13 · GET /drivers/me
Deps: T12
- `authenticate("driver", ["session","bearer"])` on `/drivers/me*`.
- Tests: driver token → 200; admin token → 401; no token → 401.

### [ ] T14 · GET/POST /admin/drivers
Deps: T12
- Paginated list + create.

### [ ] T15 · POST /admin/orders/:id/assign-driver
Deps: T12 · Ships: `order ↔ driver` link, `assign-driver` workflow
- One driver per order; reassigning replaces the previous link.
- Canceled/completed order → 400; unknown order/driver → 404.

### [ ] T16 · GET /drivers/me/orders
Deps: T13, T15
- Only the authenticated driver's orders; paginated; filter by delivery status.
- Test: driver A never sees driver B's orders.

### [ ] T17 · POST /drivers/me/orders/:id/delivered
Deps: T16 · Ships: `confirm-delivery` (part 1)
- Marks the fulfillment as delivered (core flow).
- Order not assigned to this driver → 404 (don't leak existence). Idempotent.

### [ ] T18 · POST /drivers/me/orders/:id/collect-payment
Deps: T11, T17
- Captures the manual payment (core `capturePaymentWorkflow`). Only after delivered.
- Double capture → 409.