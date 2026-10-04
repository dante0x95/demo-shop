#!/bin/bash
# Merge one PR after the full checks, safely while other sessions do the same.
# usage: scripts/merge-pr.sh <worktree-path> <pr-number> [e2e spec filter ...]
# Holds a repo-wide merge lock for the whole run, so merges happen one at a time and each PR is
# checked against the main it will land on. e2e runs under its own lock (fixed DB and port).
# Exit codes: 0 merged · 2 conflict with main (resolve, push, rerun) · 3 checks failed
#             4 e2e failed · 5 push failed · 6 gh pr merge failed · 7 PR not ready (draft/closed)
set -uo pipefail
[ $# -ge 2 ] || { echo "usage: $0 <worktree-path> <pr-number> [e2e spec filter ...]"; exit 1; }
COMMON=$(git -C "$(dirname "$0")" rev-parse --path-format=absolute --git-common-dir) || exit 1
if [ -z "${MERGE_LOCKED:-}" ]; then
  echo "[$(date +%T)] waiting for the merge lock"
  exec lockf -k -t 7200 "$COMMON/pr-merge.lock" env MERGE_LOCKED=1 "$0" "$@"
fi
WT=$1; PR=$2; shift 2
echo "[$(date +%T)] merge lock held for PR #$PR"
cd "$WT" || exit 1
state=$(gh pr view "$PR" --json state,isDraft --jq '"\(.state) \(.isDraft)"')
[ "$state" = "OPEN false" ] || { echo "PR #$PR is not open and ready ($state)"; exit 7; }
git fetch -q origin || exit 1
if ! git merge --no-edit origin/main; then
  git merge --abort
  echo "CONFLICT with origin/main: merge it yourself, resolve keeping both sides, run the checks, push, then rerun this script"
  exit 2
fi
cd apps/backend || exit 1
# build first: it regenerates Medusa's types (links merged from main), which tsc needs
for step in "npm run build" "npx tsc --noEmit" "npm run test:unit" "npm run test:integration:http" "npm run test:integration:modules"; do
  echo "[$(date +%T)] $step"
  $step > "/tmp/merge-pr-$PR.log" 2>&1 || { echo "CHECK FAILED: $step (log: /tmp/merge-pr-$PR.log)"; tail -40 "/tmp/merge-pr-$PR.log"; exit 3; }
  grep -hE '^(Tests|Test Suites):' "/tmp/merge-pr-$PR.log"
done
if [ $# -gt 0 ]; then
  echo "[$(date +%T)] e2e: $*"
  lockf -k -t 3600 "$COMMON/e2e.lock" npm run test:e2e -- "$@" > "/tmp/merge-pr-$PR-e2e.log" 2>&1 \
    || { echo "E2E FAILED (log: /tmp/merge-pr-$PR-e2e.log)"; tail -40 "/tmp/merge-pr-$PR-e2e.log"; exit 4; }
  tail -5 "/tmp/merge-pr-$PR-e2e.log"
fi
cd "$WT" || exit 1
git push -q || { echo "PUSH FAILED"; exit 5; }
sleep 5
gh pr merge "$PR" --merge || { echo "gh pr merge FAILED"; exit 6; }
echo "[$(date +%T)] MERGED PR #$PR at $(git rev-parse --short HEAD)"
