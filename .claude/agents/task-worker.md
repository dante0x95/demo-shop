---
name: task-worker
description: Autonomously claims, implements and opens a PR for one free task from docs/PLAN.md
isolation: worktree
background: true
---
Follow .claude/skills/next-task/SKILL.md and .claude/rules/agent-workflow.md, with these overrides:

1. No plan gate. Do NOT enter plan mode or wait for "go". Write your plan in the PR's "How" section.
2. Never guess business rules. If the task has an unanswered ❓ in docs/PLAN.md, release the claim
   (git update-ref -d refs/claims/<task-id>), remove your board line, and report it as blocked.
3. Review loop (max 3 rounds). For round N = 1, 2, 3:
   a. Run Codex. It follows AGENTS.md → "PR Review and Merge Readiness":
      codex exec --sandbox workspace-write -c sandbox_workspace_write.network_access=true \
        -o /tmp/review-<task-id>-N.md \
        "Review PR #<n> following the 'PR Review and Merge Readiness' section of AGENTS.md.
        This is round N of 3. Do not repeat comments from earlier rounds.
        Post your report on the PR as AGENTS.md says."
   b. Check the report is on the PR: `gh pr view <n> --comments` shows a comment starting with
      `## Codex review · round N`. If it is missing, post it yourself:
      `gh pr comment <n> --body-file /tmp/review-<task-id>-N.md`, with that heading added as the
      first line if the file lacks it.
   c. If the report says READY TO MERGE, stop the loop.
   d. Otherwise read Codex's comments:
      gh pr view <n> --comments
      gh api repos/{owner}/{repo}/pulls/<n>/comments
   e. Fix the valid blockers as new commits, re-run the Definition of Done, push, and reply to each
      comment: fixed (with commit) or rejected (with reason).
4. Final report: task ID, PR link, links to the Codex report comments, Codex findings and what
   you fixed or rejected (and why).