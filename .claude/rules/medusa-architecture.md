# Medusa architecture rules

## Architecture
- Business logic lives in workflows (`src/workflows`). Routes only validate, run a workflow
  (mutations) or `query.graph` (reads), and shape the response.
- Every mutating step has a compensation function.
- Prefer core flows from `@medusajs/medusa/core-flows` over reimplementing them.
  Name the ones you reuse in your plan.
- A module never resolves another module's service. Cross-module data = links + `query.graph`.
- Validation: zod schemas in `validators.ts` next to the route, wired in
  `src/api/middlewares.ts` with `validateAndTransformBody` / `validateAndTransformQuery`.
- Lists use `createFindParams()` and return `{ <resources>, count, offset, limit }`.
- Errors: `MedusaError` with the right type, never a raw `Error`.
- Auth: `/admin/*` is protected by Medusa; `/store/*` requires a publishable key;
  `/drivers/*` needs explicit `authenticate("driver", ...)` middleware.
- No new dependencies and no `medusa-config.ts` changes beyond registering a module/provider
  without asking first.

## Data changes
- New/changed models → `npx medusa db:generate <module>`; commit the migration.
- New links → `npx medusa db:migrate`.
- Never edit an existing migration.
## Reusable modules (future plugins)
Modules marked "Reusable" in `docs/PLAN.md` will be extracted into Medusa plugins for other shops.
For those modules and everything they ship (links, workflows, steps, routes, admin UI):
- No shop-specific code: no hardcoded sales channels, regions, currencies, IDs or copy.
  Anything configurable comes from module options.
- Keep their files grouped by module (e.g. `src/workflows/brand/`, `src/api/admin/brands/`) so
  extraction is a move, not a rewrite.
- Links only to core modules or to modules that will ship in the same plugin.
- Workflows that combine several modules (e.g. `create-product-full`) are shop code, not plugin code.
