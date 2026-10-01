# Agent workflow (human in the loop)

## Plan gate (before any code)
Start every task in plan mode and reply with:
- Files to create / modify
- Models + migrations
- Workflows, steps, compensations, core flows reused
- Request/response shape + auth
- Test cases
- Assumptions and open questions (❓ items in docs/PLAN.md)
Wait for my "go". Ask about business rules; never guess them.

## Definition of Done (all must pass locally)
1. `npx tsc --noEmit`
2. `npm run build`
3. `npm run test:integration:http`: per endpoint, test the happy path, 400 validation, 404, and 401.
4. `npm run test:integration:modules`: for services with custom logic.
Never skip tests, use `.only`, or weaken an assertion to make it pass.

## Git workflow
- One task from `docs/PLAN.md` = one branch = one PR. Never start the next task in the same session.
- Branch from up-to-date `main`: `feat/<task-id>-<slug>` (e.g. `feat/T05-media-upload`).
- Small conventional commits: `feat(media): add media_asset model`.
- Never push to `main`, merge, force-push, or rewrite history.
- In the same PR: tick the item in `pendientes.md` and set the task to `[~]` in `docs/PLAN.md`.
- Open the PR with `gh pr create` using the template below, then STOP.
- Review feedback = new commits on the same branch.

## PR template
### What
### Why (pendientes.md item)
### How (workflows, core flows reused)
### Tests (output summary)
### Migrations (none | names)
### Risks / follow-ups