---
name: commit-and-push
description: Commit and publish completed Nexora implementations to the configured GitHub repository. Use whenever a project integration, code change, functional change, documentation update, bug fix, or milestone slice is complete and has been validated.
---

# Commit and push Nexora changes

After completing and validating an implementation:

1. Run the relevant quality checks. Do not commit known failing work unless the user explicitly requests a checkpoint commit.
2. Inspect `git status -sb` and `git diff --stat`. Include only files belonging to the completed task; ask before staging unrelated changes.
3. Stage the intended files explicitly. Use `git add -A` only when the whole worktree is confirmed in scope.
4. Create a small Conventional Commit in English, for example `feat: add transaction splits` or `fix: preserve transfer cancellation`.
5. Push the current branch to `origin` with upstream tracking when needed.
6. Report the commit hash, branch, remote URL, pushed status, and checks executed.

For Nexora, default to committing directly to `main` only when the user asked to publish the completed implementation. Otherwise use a task branch and open a draft PR following the GitHub publishing workflow.

Never force-push, rewrite history, publish secrets, or commit generated ignored files.
