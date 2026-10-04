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
3. `npm run test:unit`: unit tests for new or changed code, following
   `.claude/rules/unit-tests.md`.
4. `npm run test:integration:http -- <specs>`: per endpoint, test the happy path, 400 validation,
   404, and 401.
5. `npm run test:integration:modules -- <module paths>`: for services with custom logic.

Integration tests are scoped to the task: run only the suites for the modules and endpoints it
adds or changes (e.g. `-- integration-tests/http/drivers`, `-- src/modules/brand`), not the whole
suite. Also run the suites of other modules when the diff changes code they depend on:
`src/api/middlewares.ts`, links, shared workflows/steps/utils, `integration-tests/helpers`,
`medusa-config.ts`. Name the suites you ran when you report.
Never skip tests, use `.only`, or weaken an assertion to make it pass.

## Git workflow
- One task from `docs/PLAN.md` = one branch = one PR. Never start the next task in the same session.
- Branch from up-to-date `main`: `feat/<task-id>-<slug>` (e.g. `feat/T05-media-upload`).
- Small conventional commits: `feat(media): add media_asset model`.
- Never push to `main`, merge a PR, force-push, or rewrite history. Merging `origin/main` into
  your own task branch is allowed (see below).
- Task PRs never edit `pendientes.md`, nor status in `docs/PLAN.md` (`[ ]`/`[x]` headings,
  "Free right now"). Dante reconciles both by hand after merges. A task may only add its
  plan-gate decisions (`Decided:` bullets) inside its own section of `docs/PLAN.md`.
- Before opening the PR: `git merge origin/main`, then re-run the Definition of Done.
- Open the PR as a draft with `gh pr create --draft`, using the template below. Codex reviews it
  first. Mark it ready (`gh pr ready <n>`) only after Codex's review is done: the repo ruleset
  skips drafts, so that is what starts Copilot's review (if the PR timeline shows no Copilot
  review request, `gh pr edit <n> --add-reviewer @copilot`).
  Append `· PR #<n>` to your line in the board (`trabajo.md`), then STOP.
- Review feedback = new commits on the same branch. Every Codex and Copilot comment gets a fix
  (commit) or a reply with the reason; a PR with an unanswered comment is not ready to merge.

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
Only these two sections, kept short. No implementation details, file lists, plans, test output
or risk lists: the diff and CI carry those.
### Business value
1-3 sentences (task ID first): what the shop, admin, driver or customer can do now, and why it
matters.
### How to test
Numbered steps to try the feature by hand: the request (method, path, auth, sample body) and the
expected result. Include the main error cases only when they are part of the feature.