---
name: next-task
description: Pick the next free task from docs/PLAN.md (all deps merged, not claimed by another session), claim it and start its plan gate. For running several agent sessions in parallel.
disable-model-invocation: true
---

# Next free task

Run this at the start of a session, inside its own git worktree. Follow
`.claude/rules/agent-workflow.md` ("Parallel sessions") for everything after the claim.

`<main checkout>` = the first path in `git worktree list`.

## 1. Set up the worktree (skip what already exists)
- `git rev-parse --show-toplevel` must not be the main checkout. If it is, stop: tell the user
  to start the session with `claude --worktree <name>`.
- `node_modules/` missing → install one worktree at a time, so sessions started together queue
  instead of slowing each other down (one install ~18s; five at once ~75s each):
  `lockf -k -t 600 "$(git rev-parse --git-common-dir)/npm-ci.lock" npm ci --no-audit --no-fund`
  (`lockf` waits for the lock; `npm ci` installs exactly what `package-lock.json` pins and never
  rewrites it, unlike `npm install`).
- `apps/backend/.env` missing → copy it from `<main checkout>/apps/backend/.env`.
- `apps/backend/.env.test` missing → copy it from `<main checkout>/apps/backend/.env.test`.
  Without it the integration tests fail with `role "postgres" does not exist`.
- Never print or commit either env file.

## 2. Read the board
`<main checkout>/trabajo.md` is the board: git-ignored, one copy shared by every session.
Each line is one task: `- [~] T13 · s2 · feat/T13-driver-me` (working), the same line with
`· PR #12` appended (PR open), or `- [x] T13 ...` (merged; Dante sets this). Missing file →
create it with the header from step 4.

## 3. Find the free tasks
1. `git fetch origin --prune`.
2. Read the plan as it is on main: `git show origin/main:docs/PLAN.md`. Never use the local copy.
3. A task is **done** if it is `[x]` on the board or its heading is `[x]` on `origin/main`.
   Task PRs don't update PLAN.md, so the board is usually the fresher of the two.
4. Candidates: tasks not done whose every `Deps:` task is done. Skip:
   - deps outside the backlog (e.g. "custom admin phase");
   - conditional deps unless the dep is done or the plan records the ❓ answer that removes it.
5. Drop tasks someone already owns. Any of these means taken:
   - the task has a `[~]` line on the board;
   - `git for-each-ref --format='%(refname)' refs/claims/<task-id>` prints a ref;
   - `git branch -a --list "*feat/<task-id>-*"` prints a branch;
   - `gh pr list --state open --search "<task-id> in:title"` finds a PR.
6. Order what is left: first the task that the most other open tasks depend on (directly or
   through other tasks), then plan order.

## 4. Claim
- Try the first candidate: `git update-ref refs/claims/<task-id> origin/main ""`. This is the
  lock: it fails if another session claimed the task a moment ago; then try the next candidate.
  The board is for people and can race; the ref can't.
- Right after a successful claim:
  - `git switch -c feat/<task-id>-<slug> origin/main`;
  - add your line to the board (`- [~] <task-id> · <worktree name> · <branch>`). Only ever edit
    your own line. Header for a new board:
    ```
    # Trabajo en curso (local, no versionado)
    Una línea por tarea: [~] trabajando · "· PR #n" al abrir el PR · [x] mergeada (la pone Dante).
    ```
- No candidate left → stop and report each open task with what it waits on (unfinished deps or
  the session/branch that owns it). Do not take a task early.

## 5. Start the task
Tell the user which task you took and why it was free, then enter plan mode and follow the
Plan gate in `.claude/rules/agent-workflow.md`. Do one task, open its PR, and stop.

When the PR is open, append `· PR #<n>` to your board line.

If the user cancels the task before a PR exists: `git update-ref -d refs/claims/<task-id>`,
delete the empty branch and remove your board line, so another session can take it.
