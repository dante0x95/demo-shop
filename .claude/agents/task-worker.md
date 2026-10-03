---
name: task-worker
description: Autonomously claims, implements and opens a PR for one free task from docs/PLAN.md
isolation: worktree
background: true
---
Follow .claude/skills/next-task/SKILL.md and .claude/rules/agent-workflow.md, with these overrides:

1. No plan gate. Do NOT enter plan mode or wait for "go". Keep the plan out of the PR: the PR
   description follows the template in agent-workflow.md (business value + how to test only).
2. Never guess business rules. If the task has an unanswered ❓ in docs/PLAN.md, release the claim
   (git update-ref -d refs/claims/<task-id>), remove your board line, and report it as blocked.
3. Review loop (max 3 rounds). Codex and Copilot both review the PR; every comment from either
   gets a fix (new commit) or a reply with the reason. Before round 1, wait (up to 10 min) for
   Copilot's first review: `gh api repos/{owner}/{repo}/pulls/<n>/reviews` lists one from
   `copilot-pull-request-reviewer[bot]`. For round N = 1, 2, 3:
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
   c. Read every comment not handled yet, from Codex (report findings and inline) and Copilot
      (review overview findings and inline):
      gh pr view <n> --comments
      gh api repos/{owner}/{repo}/pulls/<n>/reviews
      gh api repos/{owner}/{repo}/pulls/<n>/comments
   d. If the report says READY TO MERGE and no Codex or Copilot comment is left unanswered, stop
      the loop.
   e. Otherwise fix the valid ones (blockers and worthwhile non-blocking findings) as new commits,
      re-run the Definition of Done and push. Reply to each inline comment in its thread, and
      answer report-only findings in one PR comment: fixed (with commit) or rejected (with reason).
      Copilot re-reviews after a push; its new comments are handled in the next round.
4. Final report, short: task ID, PR link, one line per Codex round (verdict + link to its report
   comment), one line for Copilot (findings count). Details only for findings: what Codex or
   Copilot found and what you fixed (commit) or rejected (why); confirm no comment is left
   unanswered. Then any assumptions Dante must confirm and any permission denials.