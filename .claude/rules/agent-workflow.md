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
- Task PRs never edit `pendientes.md`, nor status in `docs/PLAN.md` (`[ ]`/`[x]` headings,
  "Free right now"). Dante reconciles both by hand after merges. A task may only add its
  plan-gate decisions (`Decided:` bullets) inside its own section of `docs/PLAN.md`.
- Before opening the PR: `git merge origin/main`, then re-run the Definition of Done.
- Open the PR with `gh pr create --reviewer @copilot` using the template below and check that
  Copilot is listed as a requested reviewer (else `gh pr edit <n> --add-reviewer @copilot`).
  Append `· PR #<n>` to your line in the board (`trabajo.md`), then STOP.
- Review feedback = new commits on the same branch.

## Parallel sessions (2-3 agents at once)
- One git worktree per session; never two sessions in the same checkout. Start each session
  with `claude --worktree <name>` and run `/next-task`.
- Board: `trabajo.md` in the main checkout (first path of `git worktree list`), git-ignored,
  one copy shared by all sessions. It lists the tasks in progress and the merged ones Dante has
  not reconciled yet. Read it before taking a task; edit only your own line.
- `/next-task` picks and claims the task: any task whose `Deps:` are all done (`[x]` on the board
  or on `origin/main`) and that has no board line, claim (`refs/claims/<task-id>`), branch or
  open PR. Never start a task by hand without that check, and never start one whose deps are
  not merged.
- Shared code files are listed in `docs/PLAN.md` → "Parallel work". In them (`middlewares.ts`,
  `medusa-config.ts`, imports) insert new entries in their sorted position, not always at the
  end, so parallel PRs touch different lines.
- Conflict with `main`: `git merge origin/main` into the task branch, keep both sides, re-run
  the Definition of Done, push a normal commit. Never rebase or force-push.
- Integration tests are safe in parallel (each suite creates its own database and port).
  Not safe in parallel: `npm run test:e2e` (fixed `medusa_e2e` database, port 9001) and
  `medusa develop` (port 9000); only one session runs each at a time.

## PR template
### What
### Why (pendientes.md item)
### How (workflows, core flows reused)
### Tests (output summary)
### Migrations (none | names)
### Risks / follow-ups