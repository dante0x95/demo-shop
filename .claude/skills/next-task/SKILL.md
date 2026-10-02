---
name: next-task
description: Pick the next free task from docs/PLAN.md (all deps merged, not claimed by another session), claim it and start its plan gate. For running several agent sessions in parallel.
disable-model-invocation: true
---

# Next free task

Run this at the start of a session, inside its own git worktree. Follow
`.claude/rules/agent-workflow.md` ("Parallel sessions") for everything after the claim.

## 1. Set up the worktree (skip what already exists)
- `git rev-parse --show-toplevel` must not be the main checkout (the first path in
  `git worktree list`). If it is, stop: tell the user to start the session with
  `claude --worktree <name>`.
- `node_modules/` missing → `npm install`.
- `apps/backend/.env` missing → copy it from `<main checkout>/apps/backend/.env`. Never print
  or commit it.

## 2. Find the free tasks
1. `git fetch origin --prune`.
2. Read the plan as it is on main: `git show origin/main:docs/PLAN.md`. Never use the local
   copy to judge status.
3. Candidates: tasks marked `[ ]` whose every `Deps:` task is `[x]`. Skip:
   - deps outside the backlog (e.g. "custom admin phase");
   - conditional deps (e.g. T07 "plus T08 if the ❓ is answered block") unless the dep is
     already `[x]` or the plan records the ❓ answer that removes it.
4. Drop tasks someone already owns. Any of these means taken:
   - `git for-each-ref --format='%(refname)' refs/claims/<task-id>` prints a ref;
   - `git branch -a --list "*feat/<task-id>-*"` prints a branch;
   - `gh pr list --state open --search "<task-id> in:title"` finds a PR.
5. Order what is left: first the task that the most other `[ ]` tasks depend on (directly or
   through other tasks), then plan order.

## 3. Claim
- Try the first candidate: `git update-ref refs/claims/<task-id> origin/main ""`.
  This fails if the ref already exists (another session claimed it a moment ago); then try the
  next candidate.
- Right after a successful claim: `git switch -c feat/<task-id>-<slug> origin/main`.
- No candidate left → stop and report each `[ ]` task with what it waits on (unmerged deps or
  the session/branch that owns it). Do not take a task early.

## 4. Start the task
Tell the user which task you took and why it was free, then enter plan mode and follow the
Plan gate in `.claude/rules/agent-workflow.md`. Do one task, open its PR, and stop.

If the user cancels the task before a PR exists: `git update-ref -d refs/claims/<task-id>` and
delete the empty branch, so another session can take it.
