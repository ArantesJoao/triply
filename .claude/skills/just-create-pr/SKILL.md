---
name: just-create-pr
description: Open a pull request for the current work following the trip.ly convention in docs/DEPLOY.md — auto-numbered "[TRPL-N] description" title, 50-char description limit, squash-merge only. Creates the PR and STOPS; it never merges and never deploys. Trigger on "/just-create-pr", "open a PR", "create a PR", "raise a PR for this".
metadata:
  author: joaoarantes.dev
  version: "1.0.0"
---

# Just Create PR

Opens a PR that follows [[DEPLOY]]. **This skill never merges.** Merging is what
puts a change on `main`, so it belongs to `/create-and-push-pr` only. Finish at
step 9 and hand the URL back, even if everything is green and obviously fine.

## 1. Preflight

```bash
git status --porcelain=v1 -uall && git branch --show-current
```

If a PR already exists for this branch (`gh pr view --json url` succeeds), do
not open a second one. Report the existing URL and stop.

## 2. Ticket number (auto-numbered)

```bash
gh pr list --state all --limit 200 --json title --jq '.[].title'
```

Parse `\[TRPL-([0-9]+)\]` out of every title, take the highest, add 1. If no PR
has ever been opened, use `TRPL-1`. No zero padding: `TRPL-7`, not `TRPL-0007`.

Never reuse a number, and never invent one out of order.

## 3. Title

`[TRPL-<n>] <description>`

- Use the operator's words if they gave a description; otherwise derive one from
  the actual diff, not from what you assumed the task was.
- Imperative mood, no trailing period. "Fix cross-midnight card ordering", not
  "Fixed the card ordering bug across midnight.".
- **The description is 50 characters maximum.** Count it. If it is over, shorten
  it; do not let it through and do not move the overflow into the body.

## 4. Uncommitted changes

If the tree is dirty, **ask the operator** which to commit:

- everything in the working tree, or
- only the files worked on during this session

Do not guess. A dirty tree often holds unrelated work in progress, and sweeping
it into a PR is not recoverable by the operator without a revert.

If the tree is clean and the work is already committed on a branch, skip ahead.

## 5. Branch

If on `main`, create the branch from the title before committing anything:

```bash
git switch -c trpl-<n>-<kebab-description>
```

Kebab form of the description: lowercase, non-alphanumeric runs collapsed to a
single hyphen. `TRPL-7` + "Fix cross-midnight card ordering" gives
`trpl-7-fix-cross-midnight-card-ordering`. Uncommitted changes carry over with
the switch. If already on a feature branch, keep it.

## 6. Checks (all three must pass)

```bash
npm run typecheck && npm run lint && npm run build
```

**Do not open a PR on a failure.** Fix it, or report it and stop.

`npm run build` is safe to run again, and it is the only thing here that
actually compiles the change. It used to hang forever — it shared `.next/` with
the operator's dev server, and a build starts by emptying that directory, so it
wedged on a file the server held open and broke the server it collided with.
`next.config.ts` now gives a local build `.next-build` and leaves `.next` to
dev, so the two never meet. It takes about half a minute, so run it here at
the gate rather than after every edit.

**Still never run `npm run dev` or `npm start`.** The operator's dev server is
already up on port 3103 — the app's only port — and it is where they do manual
QA.

If the diff touches `src/components/board/geometry.ts` or `board-canvas.tsx`,
also run `npm run verify` — it is pure logic and cheap. `npm run verify:axis`
needs a running dev server and a seeded test database, so leave it to the
operator and say in the test plan that it was not run.

## 7. Commit and push

First line of the commit message is the PR title verbatim. The body explains
**why**, not what the diff already shows. End with:

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
<how this was actually verified — commands run, flows clicked. Say plainly if
something was not verified.>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## 9. Report and stop

Give the operator the PR URL, the title, and what the checks did. Then **stop**.
Do not merge, do not offer to merge in the same breath. If they want it in they
will invoke `/create-and-push-pr`.
