# AGENTS.md

## Overview

Medusa DTC Starter — a Turborepo workspace monorepo containing a Medusa backend (`@medusajs/medusa` latest, Node 20+, PostgreSQL 15+) and an optional storefront (Next.js, Tanstack, etc...).

## Directory Structure

```text
.
├── apps/
│   ├── backend/                  # Medusa application (@dtc/backend)
│   │   ├── medusa-config.ts      # Medusa config: DB URL, CORS, secrets, modules
│   │   ├── integration-tests/    # setup.js (Jest setupFiles) and http/*.spec.ts suites
│   │   └── src/
│   │       ├── admin/            # Admin dashboard extensions (widgets/, i18n/, routes)
│   │       ├── api/              # API routes: api/store/*, api/admin/* (file-based)
│   │       ├── jobs/             # Scheduled jobs
│   │       ├── links/            # Module links between modules
│   │       ├── migration-scripts/# Data migration scripts (e.g. initial-data-seed.ts)
│   │       ├── modules/          # Custom modules (service + models + migrations)
│   │       ├── subscribers/      # Event subscribers
│   │       └── workflows/        # Workflows and workflow steps
│   └── storefront/               # OPTIONAL storefront
├── eslint.config.ts              # Root ESLint: @medusajs/eslint-plugin recommended
├── turbo.json                    # Task graph: build, dev, start, lint, test, seed
```

**`apps/storefront` is optional and may not exist.** It is skipped when the user chooses not to install it. Before running any storefront command, referencing storefront files, or assuming a full-stack change is possible, check that `apps/storefront/` exists. If it doesn't, the project is backend-only — do not scaffold it or suggest it was deleted by mistake.

Each app can have its own nested `AGENTS.md`; agents read the nearest one in the directory tree, so put app-specific context there rather than expanding this file.

## Package Manager

**The package manager is chosen at install time and is not fixed.** Detect it before running anything, in this order:

1. The `packageManager` field in the root `package.json` (e.g. `"pnpm@10.11.1"`) — authoritative when present.
2. The lockfile at the repo root: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm.

```bash
node -p "require('./package.json').packageManager ?? 'unset'"
ls pnpm-lock.yaml yarn.lock package-lock.json bun.lock bun.lockb 2>/dev/null
```

Use that manager for every command and never introduce a second lockfile. Below, `<pm>` means the detected manager. The `<pm> run <script>` and `<pm> exec <bin>` forms work across npm, pnpm, yarn, and bun; workspace-filter flags do not, so the per-app commands below `cd` into the app instead.

## Commands

Run from the repo root unless noted. Turbo skips missing apps automatically.

### Development

```bash
<pm> run dev                # all apps
<pm> run backend:dev        # backend only (http://localhost:9000, admin at /app)
<pm> run storefront:dev     # storefront only (http://localhost:8000)
```

### Build

```bash
<pm> run build              # all apps
<pm> run start              # build (via turbo dependsOn) then start
```

### Lint

```bash
<pm> run lint                          # all apps via turbo
cd apps/backend && <pm> run lint       # medusa lint
cd apps/storefront && <pm> run lint    # next lint
```

### Test (backend only; the storefront has no test suite)

```bash
<pm> run test                                              # all test tasks via turbo
cd apps/backend && <pm> run test:unit                      # **/src/**/__tests__/**/*.unit.spec.ts
cd apps/backend && <pm> run test:integration:modules       # **/src/modules/*/__tests__/**
cd apps/backend && <pm> run test:integration:http          # **/integration-tests/http/*.spec.ts
cd apps/backend && <pm> run test:e2e                       # Playwright, admin UI (e2e/**/*.spec.ts)
```

E2E notes: run `npx playwright install chromium` once. Each run drops and recreates a dedicated
`medusa_e2e` database (same server as `DATABASE_URL`, never the dev database), creates an admin
user and starts `medusa develop` on port 9001. Artifacts (traces, report) go to
`apps/backend/.playwright/`, a dot directory so the dev server's file watcher ignores it.

Single test — pass a path/pattern through to Jest, keeping `TEST_TYPE`:

```bash
cd apps/backend && <pm> run test:unit -- src/modules/foo/__tests__/service.unit.spec.ts
cd apps/backend && <pm> run test:unit -- -t "returns the cart"
```

### Database

```bash
cd apps/backend
<pm> exec medusa db:generate <module-name>   # generate migrations for a custom module
<pm> exec medusa db:migrate                  # run migrations
<pm> exec medusa user -e admin@test.com -p supersecret
<pm> run backend:seed                        # from root; seeds initial data
```
## Medusa Skills & Documentation

Medusa provides agent skills containing framework-specific guidance. Use the Medusa development skills when they are available to the current agent.

Relevant skills include:

- `building-with-medusa` — backend modules, API routes, workflows, data models, and module links.
- `building-admin-dashboard-customizations` — changes under `apps/backend/src/admin`.
- `building-storefronts` — changes under `apps/storefront`.
- Medusa database/migration skills when working with custom module schema changes.

The `/plugin marketplace` and `/plugin install` commands are Claude Code-specific. Do not attempt to execute them from Codex.

When running under Codex, use installed Codex-compatible skills if available. If Medusa skills are not installed, rely on the repository code, installed package types/documentation, and official Medusa documentation rather than guessing framework APIs.

For PR review, Medusa skills are supporting documentation. They do not replace executing the repository's tests, lint, migrations checks, or inspecting the actual diff.

## Medusa Skills & MCP Server


These are optional but strongly recommended — they give documentation-backed answers instead of guesses about Medusa APIs. **Use them when available; if they are not, mention to the user that installing them meaningfully improves development on this project.**

**Agentic skills** ([docs](https://docs.medusajs.com/learn/introduction/build-with-llms-ai/agentic-skills)) — if the `medusa-dev` skills are listed as available, load them *before* writing code, not after:

- `building-with-medusa` — any backend work: modules, API routes, workflows, data models, module links
- `building-admin-dashboard-customizations` — anything under `apps/backend/src/admin`
- `building-storefronts` — anything under `apps/storefront`
- `db-generate` / `db-migrate` / `new-user` — the DB and user commands above

If they are not installed, suggest:

```bash
/plugin marketplace add medusajs/medusa-agent-skills
/plugin install medusa-dev@medusa
```

**MCP server** ([docs](https://docs.medusajs.com/learn/introduction/build-with-llms-ai/mcp-server)) — a `medusa` MCP server exposing the official docs. Prefer it over web search or memory for any Medusa API, config, or upgrade question. If it is not connected, suggest:

```bash
claude mcp add --transport http medusa https://docs.medusajs.com/mcp # or agent equivalent
```

## Code Style

- **The backend must satisfy `@medusajs/eslint-plugin`'s recommended config** (`eslint.config.ts`). Its rules encode Medusa framework requirements — correct route/workflow/module shapes, not just cosmetics — so a lint failure usually means the code is actually wrong, not just badly formatted. Never disable a `@medusajs/*` rule to make lint pass; fix the code.
- No semicolons. Double quotes, 2-space indent.
- Files: kebab-case. Types/classes: PascalCase. Functions/variables: camelCase. DB columns: snake_case.
- No emojis in code, comments, or commit messages.

## Conventions

- **Backend routing is file-based.** A store endpoint is `src/api/store/<path>/route.ts` exporting `GET`/`POST`/etc. Don't add a router or register routes manually.
- **Business logic belongs in workflows**, not in route handlers. Routes resolve and run a workflow; workflows compose steps.
- Adding a task to `turbo.json` requires declaring its `outputs`, or Turbo will cache nothing/the wrong thing.

## Common Mistakes

- Running storefront commands without checking that `apps/storefront/` exists.
- Assuming a package manager instead of detecting it, or running a command that creates a second lockfile.
- Installing a dependency at the root instead of inside the app that needs it (`cd apps/backend && <pm> add <pkg>`).
- Editing a custom module's model without running `<pm> exec medusa db:generate <module>` — the migration is missing and the change silently never applies.
- Writing raw SQL or importing DB clients directly in the backend instead of going through module services / workflows.
- Calling the Medusa API from the storefront without `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`; requests fail with a publishable-key error, not an obvious 401.
- Running the test task without a reachable PostgreSQL — integration suites need a live DB.
- Silencing `@medusajs/*` ESLint rules instead of fixing the underlying pattern.

## Off-Limits

- `apps/backend/.medusa/`, `.next/`, `dist/`, `out/`, `.turbo/` — build output, excluded from the workspace and regenerated.
- The lockfile (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json` — whichever this install produced) — never hand-edit or delete; change it only as a side effect of a package manager command.
- `.env` / `.env.local` — never commit, print, or copy secret values out of them. Edit `.env.template` instead when documenting a new variable.
- Existing migrations in `src/modules/*/migrations/` — add a new migration rather than rewriting one that may already have run.
- Don't run destructive DB commands (drops, `db:migrate --help`-style flags that reset state) against the user's database without explicit confirmation.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->


## PR Review and Merge Readiness

When asked to review a PR, branch, or work produced by another agent, act as an independent reviewer.

The implementation may have been produced by Claude or another coding agent. Do not assume its implementation, explanation, or tests are correct.

Your priorities are, in order:

1. Understand the task and expected behavior.
2. Inspect the actual Git diff against the PR's base branch.
3. Run the relevant tests.
4. Review whether the tests adequately verify the change.
5. Inspect the implementation for defects, regressions, security issues, data-integrity problems, and incorrect Medusa patterns.
6. Determine whether the PR is ready to merge.

### Review workflow

Before reviewing code:

- Determine the current branch.
- Determine the PR/base branch. Use `main` only if that is actually the base.
- Inspect `git status`.
- Inspect the commits and diff between the base branch and current branch.
- Read any task, issue, plan, or acceptance criteria referenced by the PR when available.
- Read the PR's existing reviews and comments, including Copilot's (`gh api repos/{owner}/{repo}/pulls/<n>/reviews` and `.../comments`). Check that each earlier Codex or Copilot comment was fixed or answered with a reason; an unanswered valid one is a finding. Do not repeat a point Copilot already raised.
- Identify the affected modules, workflows, routes, migrations, admin extensions, and tests.

Useful commands include:

```bash
git status
git branch --show-current
git diff --stat <base>...HEAD
git diff <base>...HEAD
git log --oneline <base>..HEAD
```

Do not modify production code during the initial review unless explicitly asked.

### Test-first review

Testing is the first verification step after understanding the diff.

Detect and use the package manager according to this file.

Run the smallest relevant test suite first, followed by broader checks when appropriate.

For backend changes, consider:

1. targeted test file or test name
2. unit tests
3. module integration tests
4. HTTP integration tests
5. lint
6. build/type checking
7. broader repository tests when the change can affect other packages

Do not claim that a test, lint command, build, or other verification passed unless you actually executed it successfully.

If tests cannot run because of environment requirements such as PostgreSQL, report that clearly and lower confidence in the merge-readiness assessment.

### Test quality

Passing tests are not sufficient by themselves.

Review whether tests cover the behavior introduced or changed by the PR.

Depending on the feature, consider:

- happy path
- authentication
- authorization
- invalid input
- missing required input
- normalization
- duplicate values
- database constraints
- concurrency where uniqueness or invariants matter
- filtering
- pagination
- ordering
- error responses
- side effects
- transactional behavior
- workflow compensation / rollback behavior
- regressions

For API routes, verify relevant:

- status codes
- response shapes
- request validation
- query validation
- authentication / authorization
- persisted state

### Medusa review

For Medusa changes, pay particular attention to:

- module registration
- data models
- generated migrations
- module services
- workflows
- workflow steps
- compensation functions
- dependency injection
- API route conventions
- middleware registration
- request and query validation
- authentication
- authorization
- remote query / graph usage
- module links
- database constraints
- pagination and filtering conventions

Follow the Medusa version actually installed in this repository instead of assuming APIs from memory.

Application-level uniqueness checks must not be assumed to provide database-level integrity. When a value must remain unique, inspect whether an appropriate database constraint/index also exists and consider concurrent requests.

### Findings

Only report concrete findings.

Classify findings as:

- BLOCKER — should be fixed before merge.
- NON-BLOCKING — valid improvement or concern that does not need to prevent merge.
- OUT OF SCOPE — existing or unrelated issue worth mentioning separately.

Do not make stylistic preferences merge blockers.

Do not require unrelated refactors.

For each blocking finding include:

- severity
- file and location
- problem
- impact
- how it was verified
- suggested fix

### Merge readiness

End every PR review with a short report. Details are only for findings; when there is nothing
to report, summarize your work in a few lines.

No findings:

```
**READY TO MERGE** · Confidence: High | Medium | Low
2-4 lines: what you checked (commands run and their result, key behaviors verified) and, if
confidence is not High, what could not be verified.
```

With findings:

```
**READY TO MERGE** | **NOT READY TO MERGE** · Confidence: High | Medium | Low
#### Findings
Blockers first, each with the fields listed under "Findings" above. Non-blocking and out-of-scope
findings: 1-2 lines each.
#### Verification
1-3 lines: commands run and their result; important scenarios left unverified.
```

A PR is READY TO MERGE when:

- relevant tests pass
- required lint/build/type checks pass where applicable
- acceptance criteria are implemented
- important behavior has reasonable verification
- no confirmed merge blocker remains
- every earlier Codex and Copilot comment is fixed or answered with a reason
- migrations/schema changes are safe
- authentication and authorization are correct where relevant
- no significant regression was identified

A PR is NOT READY TO MERGE when a confirmed blocker remains, such as:

- relevant tests failing because of the PR
- incorrect functionality
- missing required functionality
- serious security issue
- unsafe migration/schema change
- data-integrity problem
- broken authentication or authorization
- required build/type/lint failure

Missing test coverage for important behavior is a finding, not a section of its own.

### GitHub PR comments

When reviewing a GitHub PR from the local Codex CLI:

- Use `gh` to inspect the PR when available.
- If a concrete bug or merge blocker is confirmed, publish a comment on the PR.
- Prefer an inline review comment on the relevant changed line using `gh api`.
- If an inline comment is not practical, use `gh pr comment`.
- Do not comment on speculative issues or style preferences.
- Do not publish duplicate comments.

Always publish the final review report on the PR, even when it is READY TO MERGE with no
findings:

- Post it once per review round with `gh pr comment <pr-number> --body-file <file>`.
- Start the body with `## Codex review · round <N>` (N = the round you were given, else 1),
  followed by the commit SHA you reviewed, then the report from "Merge readiness".
- Inline comments for concrete findings are still posted as above; the report comment does not
  replace them.
- If posting fails, say so at the top of the report you return, with the error.

Before posting comments, verify that `gh auth status` succeeds.

Typical commands:

```bash
gh pr view <pr-number>
gh pr diff <pr-number>
