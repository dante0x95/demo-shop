# PLAN — pendientes.md backlog

One task = one pendientes.md line = one PR. Start a task only when its deps are merged; tasks
whose deps are all merged can run in parallel (see "Parallel work"). Prerequisites (module, link, workflow, middleware) ship inside the first
task that needs them. ❓ = decide with Dante at the plan gate. Reusable = module will be extracted into a plugin
(see `.claude/rules/medusa-architecture.md`).

Status: [ ] todo · [x] merged. Reconciled by hand after merges; task PRs never change it.
Work in progress lives in the local board `trabajo.md` (main checkout, not versioned).

## Parallel work (2-3 agent sessions)

Each session runs `/next-task` in its own worktree: it takes any task whose deps are all done
(`[x]` here or on the board) and that no other session has claimed. No fixed order between sessions.
Rules: `.claude/rules/agent-workflow.md` → "Parallel sessions".

Free right now: T20, T21, T23 (API) · T24, T25, T26.1 (admin UI, one at a time).
Blocked outside this backlog: T07.1 (custom admin phase).
T20, T21 and T23 have open ❓ for the plan gate. T14.2 waits on its ❓ (open decisions from T14.1).
T19 waits on its own ❓ (one plugin or several, where to publish) and on T20, T23, T28.

Files several tasks touch (see the rules file for how to resolve a conflict):

| File | Touched by |
|------|------------|
| `apps/backend/medusa-config.ts` | T10 (module registration), T14.1 (notification provider), T19 |
| `apps/backend/src/api/middlewares.ts` | T08, T10, T14, T14.1, T15, T19 |
| `src/api/drivers/middlewares.ts` | T13, T16, T17, T18 (a chain, never in parallel), T14.1 (one public entry, sorted position) |
| `apps/backend/src/admin/lib/` (SDK, shared hooks) | T24-T30 |
| `apps/backend/src/modules/media/`, `src/api/admin/media/` | T07, T19, T26.1 |
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
- Decided: an asset in use by a product is blocked with 409. "In use" = the asset's url is a
  non-deleted product's image, product thumbnail or variant thumbnail (all three copy the url;
  no product ↔ media link yet).
  Contract for T08: store images and thumbnails as those url fields, or, if T08 adds a
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

### [x] T08 · POST /admin/products/full
Deps: T02, T05 · Ships: `create-product-full` workflow, `productsCreated` brand hook
- One request: product + options (color/size) + variants with prices + stock per location
  + brand + images (by `media_asset` id).
- Compose core flows (`createProductsWorkflow`, inventory level flows).
- Brand goes through `additional_data.brand_id`, linked by a `productsCreated` hook (validated
  with `additionalDataValidator`). Don't link twice.
- All-or-nothing. Tests: happy path; unknown brand → 400; unknown location → 400 AND no product left behind.
- Images keep T07's in-use check working: save images and thumbnails as the asset's url, or
  switch `validateMediaAssetNotInUseStep` to a new product ↔ media link in this PR.
- Decided: `brand_id` optional; any existing brand is accepted, inactive too (unknown/deleted
  → 400). Core `POST /admin/products` accepts it too, through the same hook.
- Decided: images are product-level only (`images` = media ids, `thumbnail_id` defaults to the
  first); stored as urls, so T07's check is unchanged.
- Decided: `sales_channels` pass through as sent (none → no channel), same as core.

## Phase 4 — Catalog config

### [x] T09 · GET/POST/DELETE /admin/metafield-definitions
Deps: T01 · Ships: `metafield` module (Reusable)
- key (unique per owner type), label, type (text/number/boolean/select), options, owner type.
- Decided: values live in their own table in the `metafield` module, shipped by a later task;
  T09 ships definitions only (soft delete, nothing to clean up).
- Decided: allowed owner types come from the `owner_types` module option (default `["product"]`).
- Decided: `key` must match `^[a-z][a-z0-9_]{0,63}$` (400 otherwise, never rewritten);
  `options` required and unique for `select`, rejected for other types.
- Decided: no update endpoint: list, create, GET /:id, DELETE /:id.

### [x] T10 · GET/POST/DELETE /admin/package-presets
Deps: T01 · Ships: `package-preset` module (Reusable)
- name, length, width, height, weight, units, is_default (only one default).

## Phase 5 — Drivers & delivery

### [x] T11 · Cash on delivery setup (no endpoint)
Deps: —
- Idempotent script in `src/scripts` enabling `pp_system_default` in the store region.
- Test: running it twice doesn't duplicate.

### [x] T12 · POST /drivers (registration)
Deps: T01 · Ships: `driver` module, `driver` actor type
- Flow: `POST /auth/driver/emailpass/register` → token → `POST /drivers` (Bearer)
  → workflow creates driver + `setAuthAppMetadataStep`.
- `authenticate("driver", ["session","bearer"], { allowUnregistered: true })` on `POST /drivers` only.
- If `authMethodsPerActor` exists in `medusa-config.ts`, add `driver: ["emailpass"]`.
- Test the full flow end-to-end, including login afterwards.

### [x] T13 · GET /drivers/me
Deps: T12
- `authenticate("driver", ["session","bearer"])` on `/drivers/me*`.
- Tests: driver token → 200; admin token → 401; no token → 401.
- Decided: inactive drivers get 200 with `is_active` (the app shows "pending approval");
  later `/drivers/me/*` tasks decide their own gating for inactive drivers.
- Decided: a valid token whose driver no longer exists (soft-deleted) → 404.

### [x] T14 · GET/POST /admin/drivers
Deps: T12
- Paginated list + create.

### [x] T14.1 · Driver invitation
Deps: T14 · Ships: driver invite (model + workflows), local notification provider
- Today a driver created by an admin has no login, and can't sign up because the email is taken.
- Decided: creating a driver from the admin (`POST /admin/drivers`) sends an invitation email
  with a link to set a password. Accepting it creates the driver's `emailpass` login, linked to
  that driver.
- Decided: the link is valid for 7 days. `POST /admin/drivers/:id/resend-invite` sends a new one
  and invalidates the previous link. Also usable for drivers created before this task.
- Decided: while the invitation is pending, logging in (`POST /auth/driver/emailpass`) or
  registering (`/auth/driver/emailpass/register`, `POST /drivers`) with that email returns an
  error telling the driver to check their email for the invitation.
- Decided: send through Medusa's local notification provider (no new dependency). The real email
  provider is a separate item in pendientes.md.
- Tests: create → invite sent; accept → can log in; expired or replaced link → rejected;
  login/register with a pending invite → the "check your email" error.

### [ ] T14.2 · Driver invitation follow-ups
Deps: T14.1
- Choices T14.1 (PR #23) made without a rule. Answer the ❓ with Dante before starting.
- ❓ (important) The invited email already has a login with no driver linked (an abandoned
  driver sign-up, or the same person's admin or customer login). Today accepting sets that
  login's password and links it to the driver, which changes the password for every role that
  shares the login. Keep it, reject the invite, or another flow?
- ❓ An expired invitation still counts as pending: login and sign-up keep answering "check your
  email" until an admin resends. Keep it, or let it lapse (and then what)?
- ❓ Status codes: pending-invite errors and invalid, used or expired links are all 400. Keep?
- ❓ Accept and resend share a lock from Medusa's default locking module, which only works inside
  one server process. Production with several servers needs the Redis or Postgres locking
  provider: which one, and when (a `medusa-config.ts` change)?

### [x] T15 · POST /admin/orders/:id/assign-driver
Deps: T12 · Ships: `order ↔ driver` link, `assign-driver` workflow
- One driver per order; reassigning replaces the previous link.
- Canceled/completed order → 400; unknown order/driver → 404.
- Decided: only `pending` or `requires_action` orders take a driver; `canceled`, `completed`,
  `draft` and `archived` → 400.
- Decided: an inactive driver (`is_active: false`) → 400.
- Decided: an order with a delivered fulfillment (`delivered_at` set) → 400, so it can't be
  moved to another driver after delivery.
- Decided: assigning the current driver again is a 200 no-op. A partial unique index on the
  link's `order_id` (migration script `order-driver-unique-order`) keeps one driver per order
  under concurrent requests.

### [x] T16 · GET /drivers/me/orders
Deps: T13, T15
- Only the authenticated driver's orders; paginated; filter by delivery status.
- Test: driver A never sees driver B's orders.

### [x] T17 · POST /drivers/me/orders/:id/delivered
Deps: T16 · Ships: `confirm-delivery` (part 1)
- Marks the fulfillment as delivered (core flow).
- Order not assigned to this driver → 404 (don't leak existence). Idempotent.

### [x] T17.1 · Inactive drivers can't confirm deliveries
Deps: T17
- Today a driver deactivated after being assigned can still confirm delivery.
- Decided: an inactive driver (`is_active: false`) delivers nothing, so
  `POST /drivers/me/orders/:id/delivered` → 403 "Driver is inactive", and nothing is delivered.
- Decided: the inactive check runs before the ownership check, so an inactive driver gets 403
  for any order id, even one that isn't theirs or doesn't exist.
- Tests: deactivate after assignment → 403, fulfillment stays undelivered; reactivate → 200.

### [x] T18 · POST /drivers/me/orders/:id/collect-payment
Deps: T11, T17, T17.1
- Captures the manual payment (core `capturePaymentWorkflow`). Only after delivered.
- Double capture → 409.
- Decided: an inactive driver can't collect payment → 403 "Driver is inactive" (same as T17.1).
- Decided: "delivered" = every non-canceled fulfillment has `delivered_at`, and there is at least
  one; otherwise 400. Canceled order → 400; unknown, unassigned or another driver's order → 404.
- Decided: only the manual provider's (`pp_system_default`) non-canceled payment is collected,
  for its full amount; none → 400, several pending → 400 (an admin captures them). The capture
  records the driver id as `captured_by`. No request body.
- Decided: response `{ order, payment }`: the order with the driver order fields (`fields`
  narrows it) and `payment` = id, amount, currency_code, captured_at. 409 keeps its message.

## Phase 6 — Product parity (Shopify product form)

Fields Shopify's product page has and Medusa lacks. Each task ships its own admin endpoint; the
"Add product" page (T30) calls them right after `POST /admin/products/full`, so these tasks
don't touch `create-product-full` and can run in parallel.

### [ ] T20 · Product metafield values
Deps: T09 · Ships: metafield values (`metafield` module, Reusable)
- Store and edit a product's values for its metafield definitions (`owner_type: product`), e.g.
  "Disclosures". Each value is validated against its definition's type and `select` options.
- ❓ What happens to stored values when a definition is deleted. ❓ Whether `/store` product
  responses expose the values (storefront and WhatsApp agent).

### [ ] T21 · Compare-at price and cost per item
Deps: T08
- Per variant, like Shopify. Compare-at shows a discount on the storefront; cost per item feeds
  margin and is admin-only (never in `/store` responses).
- ❓ Compare-at storage: Medusa "sale" price list (the storefront gets original vs calculated
  price for free) or a stored amount per variant and currency. ❓ Must compare-at be higher
  than the price. ❓ Cost currency (store default only, or per currency).

### [x] T22 · Product SEO title and meta description
Deps: —
- Admin sets an SEO page title and meta description per product; the URL slug stays `handle`.
  `/store` product responses expose them so the storefront can render the tags.
- Decided: SEO title is never empty. If the admin hasn't set one, the product title is used.
  Nothing is stored until the admin edits it, so an unedited SEO title follows later renames of
  the product. Clearing the field (empty or whitespace-only) goes back to the fallback.
- Decided: Empty meta description → falls back to the product description, cut to 160
  characters.
- Decided: No length limits enforced by the API. 70 (title) / 160 (meta description) are only a
  UI character counter (Shopify-style), which belongs to T29.

### [ ] T23 · Package preset per product
Deps: T10 · Ships: `product ↔ package_preset` link (`package-preset`, Reusable)
- "Package when shipped alone": pick a package preset for a product; none set → the store's
  default preset.
- ❓ Per product or per variant.

## Phase 7 — Admin UI (Medusa's built-in panel, temporary)

Pages and widgets in `src/admin` for features that have no screen yet, like the Brands pages.
Load the `building-admin-dashboard-customizations` skill. Tests: `npm run test:e2e`, which is not
safe in parallel (fixed database and port), so never run two Phase 7 tasks at once. UI for
Reusable modules (T26, T27, T28) keeps its files grouped by module so T19 can move them.

### [ ] T24 · Drivers page
Deps: T14.1
- List (paginated, `is_active` filter), create, and resend invitation.

### [ ] T25 · Assign-driver widget on the order page
Deps: T15, T17
- Shows the assigned driver and delivery status; admin picks or changes the driver. Shows the
  API's 400 reasons (inactive driver, canceled or delivered order).

### [x] T26 · Media library page
Deps: T07
- Browse (paginated, search, type filter), upload and delete media assets.

### [ ] T26.1 · Media library page follow-ups
Deps: T26
- Left over from T26 (PR #22).
- The type filter lists all five types the media module supports, even when the shop allows
  fewer through `MEDIA_ALLOWED_MIME_TYPES` (uploads of the others fail with 400). Show only the
  allowed types, read from the module's options (media is Reusable: no hardcoded list).
- E2E: image previews point at `localhost:9000` while the e2e server runs on 9001, so thumbnails
  don't load in tests. Make file URLs follow the server's port in e2e and assert a thumbnail loads.

### [x] T27 · Package presets settings page
Deps: T10
- List, create and delete presets; mark the default.
- Added `POST /admin/package-presets/:id/set-default` (PR #25): T10's API had no way to make an
  existing preset the default. No "unset default" action.

### [ ] T28 · Metafields UI
Deps: T20
- Settings page for metafield definitions, and a product-page widget to edit the product's
  metafield values.

### [ ] T29 · Product-page widgets for compare-at, cost, SEO and package
Deps: T21, T22, T23
- Edit compare-at price and cost per item per variant, SEO title and meta description, and the
  product's package preset.

### [ ] T30 · "Add product" page (Shopify-style)
Deps: T08, T20, T21, T22, T23, T26
- One page like Shopify's: title, description, media picked from or uploaded to the library,
  category, price, compare-at, cost, stock per location, SKU and barcode, shipping (package,
  size, weight, origin, HS code), variants, metafields, SEO, status, sales channels, type,
  brand as vendor, collection and tags.
- Saves with `POST /admin/products/full`, then the T20-T23 endpoints. If one of those fails,
  the product stays created and the page shows which part to retry.

## Phase 8 — Reuse

### [ ] T19 · Extract reusable modules into plugin(s)
Deps: T04, T07, T08, T09, T10, T20, T23, T26, T27, T28 (T08 decides which brand/media code stays in the app)
- Move every Reusable module (brand, media, metafield, package-preset) with its links,
  workflows, routes and admin UI into `packages/`, built with `medusa plugin:build`.
- This shop consumes the plugin(s) via `plugins` in `medusa-config.ts`; shop workflows
  (`create-product-full`) stay in the app.
- Existing tables and migrations must carry over: no duplicate tables, no data loss.
- ❓ One plugin per module or one shared plugin. ❓ Publish target (npm private / GitHub Packages).
- Tests: all existing HTTP suites pass unchanged against the plugin-backed app.
