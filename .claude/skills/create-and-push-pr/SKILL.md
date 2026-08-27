---
name: create-and-push-pr
description: Open a pull request following the trip.ly convention in docs/DEPLOY.md, wait for the remote checks to pass, then squash merge it to main. Use only when the change is verified and meant to land now; use /just-create-pr instead to open a PR without merging it. Trigger on "/create-and-push-pr", "ship it", "create and merge the PR", "land this".
metadata:
  author: joaoarantes.dev
  version: "1.0.0"
---

# Create and Push PR

Same as `/just-create-pr`, then merges. **`main` is the release branch** — once
hosting is wired up, merging is what deploys, so treat every merge as a release.
The operator invoking this skill is the authorization to merge; you do not need
to ask again. What you must not do is merge on a red build or a failed check.

Steps 1 through 8 are identical to [[just-create-pr]] and are repeated here so
this skill stands alone.

## 1. Preflight

```bash
git status --porcelain=v1 -uall && git branch --show-current
```

If a PR already exists for this branch (`gh pr view --json url,number`
succeeds), reuse it — skip to step 9 rather than opening a duplicate.

## 2. Ticket number (auto-numbered)

```bash
gh pr list --state all --limit 200 --json title --jq '.[].title'
```

Parse `\[TRPL-([0-9]+)\]` out of every title, take the highest, add 1. If no PR
has ever been opened, use `TRPL-1`. No zero padding: `TRPL-7`, not `TRPL-0007`.

## 3. Title

`[TRPL-<n>] <description>`

Imperative mood, no trailing period, and the **description is 50 characters
maximum** — count it and shorten if needed.

## 4. Uncommitted changes

If the tree is dirty, **ask the operator** whether to commit everything in the
working tree, or only the files worked on during this session. Do not guess.
This skill lands the change on `main`, so sweeping up unrelated work in progress
is worse here than anywhere else.

## 5. Branch

If on `main`, create the branch before committing:

```bash
git switch -c trpl-<n>-<kebab-description>
```

## 6. Checks (all three must pass)

```bash
npm run typecheck && npm run lint && npm run build
```

This is the one moment the build is allowed to run — the operator otherwise
keeps their own dev server and does manual QA in a separate terminal.

**Do not proceed on a red build.** Report the failure and stop.

If the diff touches `src/components/board/geometry.ts` or `board-canvas.tsx`,
also run `npm run verify`. `npm run verify:axis` needs a running dev server and
a seeded test database — leave it to the operator and say so in the test plan.

## 7. Commit and push

First line of the commit message is the PR title verbatim; the body explains
why. End with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

```bash
git push -u origin <branch>
```

## 8. Open the PR

```bash
gh pr create --base main --title "[TRPL-<n>] <description>" --body "$(cat <<'EOF'
## Summary
<what changed and why, 1-3 bullets>

## Test plan
<how this was actually verified. Say plainly if something was not verified.>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## 9. Wait for the remote checks

A green local build is not the same as the host building it. A missing
production env var, for instance, fails only there. Wait for the real check:

```bash
gh pr checks --watch
```

- Passes: continue to step 10.
- Fails: **stop.** Report which check failed and why. Do not merge, and do not
  merge with `--admin` to get around it.
- No checks configured at all (command reports none): say so explicitly in the
  final report, then continue. Triply has no CI wired up yet, so this is the
  expected path today — the operator should know the merge went in on the local
  build alone.

## 10. Squash merge

```bash
gh pr merge --squash --delete-branch
```

`--squash` is mandatory: one PR becomes one commit on `main`, so one commit
equals one release and a revert is a single-commit operation. The repo deletes
the remote branch on merge by itself; `--delete-branch` is still passed because
it also removes the local branch, so the operator's checkout stays clean.

## 11. Sync local

```bash
git checkout main && git pull
```

## 12. Report

Give the operator: the PR URL, the squashed commit sha on `main`, and a plain
statement of what just landed. If the change needs anything that is not in the
repo — a new env var, a Drizzle migration to push against Neon, a Google OAuth
console change — say so here, unprompted. A green merge with a missing env var
is a broken site.
