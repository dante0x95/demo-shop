# PLAN — pendientes.md backlog

One task = one pendientes.md line = one PR. Start a task only when its deps are merged; tasks
whose deps are all merged can run in parallel (see "Parallel work"). Prerequisites (module, link, workflow, middleware) ship inside the first
task that needs them. ❓ = decide with Dante at the plan gate. Reusable = module will be extracted into a plugin
(see `.claude/rules/medusa-architecture.md`).

Status: [ ] todo · [~] in PR · [x] merged

## Parallel work (2-3 agent sessions)

Each session runs `/next-task` in its own worktree: it takes any `[ ]` task whose deps are all
`[x]` on `origin/main` and that no other session has claimed. No fixed order between sessions.
Rules: `.claude/rules/agent-workflow.md` → "Parallel sessions".

Free right now: T08, T09, T10, T11, T12.
Blocked outside this backlog: T07.1 (custom admin phase).
T12 unblocks the most work (T13-T18), so `/next-task` picks it first.

Files most PRs touch (expect small merge conflicts, see the rules file for how to resolve):

| File | Touched by |
|------|------------|
| `pendientes.md`, `docs/PLAN.md` | every task |
| `apps/backend/medusa-config.ts` | T09, T10, T12 (module registration), T19 |
| `apps/backend/src/api/middlewares.ts` | T08, T09, T10, T12, T13, T14, T15, T19 |
| `apps/backend/src/modules/media/`, `src/api/admin/media/` | T07, T19 |
| `apps/backend/src/modules/brand/`, `src/workflows/brand/` | T08 (brand hook), T19 |

## Phase 1 — Brand (calibration)

### [x] T01 · GET/POST /admin/brands
Deps: — · Ships: `brand` module (`brand`, Reusable), `create-brand` workflow, integration test setup
- Nothing exists yet: build the module, workflow and routes from scratch. Once merged,
  this is the reference implementation the other modules mirror.
- Fields (decided): name, handle, description, logo_url, banner_url, is_active (default true),
  metadata. Name unique case-insensitive and handle unique, duplicates → 400.
- Tests: create → 200; missing name → 400; list paginated; no auth → 401.

### [x] T01.1 · Admin panel: Brands list + create
Deps: T01 · Ships: admin JS SDK client (`src/admin/lib/sdk.ts`)
- Temporary UI in Medusa's built-in admin (`/app`) until the custom admin phase; keep it minimal.
- "Brands" sidebar entry → page with a paginated table (name, handle, is_active) from
  `GET /admin/brands`, and a "Create brand" form calling `POST /admin/brands`.
- Show the API's 400 messages on the form (missing name, duplicate name/handle, invalid URL).
- Load the `building-admin-dashboard-customizations` skill first. No new endpoints.
- Verify: `npm run build` passes; manual check in `/app`: list paginates, create works,
  duplicate shows the error. (No admin UI test suite exists.)

### [x] T02 · GET/POST/DELETE /admin/brands/:id
Deps: T01 · Ships: `product ↔ brand` link
- GET returns the brand with linked products. POST is a partial update.
- DELETE via workflow: unlinks products, never deletes them.
- Unknown id → 404 on all three.

### [x] T03 · GET /store/brands
Deps: T02
- Publishable key required; paginated; public fields only.

### [x] T04 · GET /store/brands/:id/products
Deps: T03
- Only `published` products in the key's sales channel; paginated.
- Variants with calculated prices for a `region_id` query param (the WhatsApp agent needs prices).
- Decided: `region_id` is required (missing/unknown → 400); inactive or deleted brand → 404.

### [x] T04.1 · Admin panel: Brand detail (edit, delete, linked products)
Deps: T02, T04 · Ships: `src/admin/routes/brands/[id]/page.tsx`
- Clicking a row in the Brands table opens a detail page (`GET /admin/brands/:id`) showing the
  brand fields and its linked products.
- Edit form calls `POST /admin/brands/:id`; show the API's 400 messages (duplicate
  name/handle, invalid URL).
- Delete button with confirmation calls `DELETE /admin/brands/:id`, then returns to the list.
  Products are unlinked, never deleted.
- Load the `building-admin-dashboard-customizations` skill first. No new endpoints.
- E2E (`e2e/admin/brand-detail.spec.ts`): open detail from the list; edit persists after reload;
  duplicate name shows the error; delete removes the brand from the list and keeps the product;
  unknown id shows a not-found state.

## Phase 2 — Media library

### [x] T05 · POST /admin/media
Deps: T01 · Ships: `media` module (`media_asset`, Reusable), multer middleware
- Upload the files, then create `media_asset` rows (url, file_id, mime_type, size, alt).
- If row creation fails, compensation deletes the uploaded files. If only some uploads
  succeed, those are deleted too (own step: core `uploadFilesStep` can't clean up after a
  partial failure).
- Decided: images only (jpeg, png, webp, gif, avif; no SVG), max 5 MB per file, max 10 files
  per request; all overridable via `media` module options, which `medusa-config.ts` fills from
  `MEDIA_MAX_FILE_SIZE`, `MEDIA_MAX_FILES`, `MEDIA_ALLOWED_MIME_TYPES`. Extension and file
  signature must match the declared type. `alt` is optional, sent per file by index; more
  `alt` values than files → 400.
- Tests: 2 images → 200; non-image → 400; no auth → 401.

### [x] T06 · GET /admin/media
Deps: T05
- Paginated, newest first, filters: `q` (alt/filename), `mime_type`.

### [x] T07 · DELETE /admin/media/:id
Deps: T05 (the "block" answer would have added T08; the in-use check by url below removes it)
- Delete the record first, the file last (file deletion can't be compensated).
- Decided: an asset in use by a product is blocked with 409. "In use" = a non-deleted product
  image with the asset's url (product images copy the url; no product ↔ media link yet).
  Contract for T08: store images as product images with the asset's url, or, if T08 adds a
  product ↔ media link, switch `validateMediaAssetNotInUseStep` to that link in the same PR.

### [ ] T07.1 · Direct-to-storage uploads (presigned URLs)
Deps: T05, custom admin phase (changes how the frontend uploads)
- Shopify-style: the client asks for presigned upload URLs (file module `getUploadFileUrls`),
  uploads the bytes straight to storage, then `POST /admin/media` only registers them. The
  backend never holds file bytes in memory.
- Needs a provider that supports presigned uploads (e.g. S3); keep the multipart path for the
  local provider.
- ❓ Provider for production. ❓ How content is verified when the bytes never reach the backend.
- ❓ Cleanup of files uploaded but never registered.

## Phase 3 — Shopify-style product creation

### [ ] T08 · POST /admin/products/full
Deps: T02, T05 · Ships: `create-product-full` workflow, `productsCreated` brand hook
- One request: product + options (color/size) + variants with prices + stock per location
  + brand + images (by `media_asset` id).
- Compose core flows (`createProductsWorkflow`, inventory level flows).
- Brand goes through `additional_data.brand_id`, linked by a `productsCreated` hook (validated
  with `additionalDataValidator`). Don't link twice.
- All-or-nothing. Tests: happy path; unknown brand → 400; unknown location → 400 AND no product left behind.
- Images keep T07's in-use check working: save them as product images with the asset's url, or
  switch `validateMediaAssetNotInUseStep` to a new product ↔ media link in this PR.

## Phase 4 — Catalog config

### [ ] T09 · GET/POST/DELETE /admin/metafield-definitions
Deps: T01 · Ships: `metafield` module (Reusable)
- key (unique per owner type), label, type (text/number/boolean/select), options, owner type.
- ❓ Where values live: product `metadata` or own table.

### [ ] T10 · GET/POST/DELETE /admin/package-presets
Deps: T01 · Ships: `package-preset` module (Reusable)
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

## Phase 6 — Reuse

### [ ] T19 · Extract reusable modules into plugin(s)
Deps: T04, T07, T08, T09, T10 (T08 decides which brand/media code stays in the app)
- Move every Reusable module (brand, media, metafield, package-preset) with its links,
  workflows, routes and admin UI into `packages/`, built with `medusa plugin:build`.
- This shop consumes the plugin(s) via `plugins` in `medusa-config.ts`; shop workflows
  (`create-product-full`) stay in the app.
- Existing tables and migrations must carry over: no duplicate tables, no data loss.
- ❓ One plugin per module or one shared plugin. ❓ Publish target (npm private / GitHub Packages).
- Tests: all existing HTTP suites pass unchanged against the plugin-backed app.
