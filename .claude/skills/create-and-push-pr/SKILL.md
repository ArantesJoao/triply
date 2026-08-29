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

## 6. Checks (both must pass)

```bash
npm run typecheck && npm run lint
```

**Do not proceed on a failure.** Report it and stop.

**Never run `npm run build` here, or anywhere.** It used to be this skill's
third check and it has been removed: on this machine it wedges before it
compiles anything — it contends with the operator's dev server for `.next/`,
which Windows locks — so it burns a long stretch of wall clock, breaks the dev
server it collided with, and still tells you nothing. The real build now runs
in exactly one place: Vercel, from `scripts/vercel-build.mjs`, on deploy. That
is the gate that catches a broken build, and it catches it after the merge
rather than before — so say so in the final report and watch the deploy.

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

Nothing has compiled this change yet — the local gate is types and lint only.
Vercel's build on deploy is the first and only thing that does. Wait for it:

```bash
gh pr checks --watch
```

- Passes: continue to step 10.
- Fails: **stop.** Report which check failed and why. Do not merge, and do not
  merge with `--admin` to get around it.
- No checks configured at all (command reports none): say so explicitly in the
  final report, then continue. Triply has no CI wired up yet, so this is the
  expected path today — and since the local gate no longer builds either, the
  operator needs to hear plainly that nothing has compiled this change and the
  Vercel deploy is where that first happens.

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
