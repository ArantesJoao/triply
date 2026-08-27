# trip.ly — Deploys

## Charter

> Agents MUST NOT modify the Charter without explicit operator approval.

- **`main` is the release branch.** Hosting is not wired up yet, but the moment
  it is, every commit on `main` goes live. Treat it that way now, so the
  convention is already in place on the day a deploy becomes automatic.
- **No direct pushes to `main`.** Every change lands through a pull request.
  This is the whole point of the convention: a deploy should be a deliberate,
  reviewable event, not a side effect of `git push`.
- **PR titles are `[TRPL-N] <description>`.**
  - `TRPL-N` is auto-numbered from the highest existing PR title, plus one. No
    zero padding: `TRPL-7`, not `TRPL-0007`. Never reuse a number, never invent
    one out of order.
  - `<description>` is **50 characters maximum**, imperative mood, no trailing
    period. "Fix cross-midnight card ordering", not "Fixed the card ordering
    bug across midnight.".
- **Squash merge only.** One PR becomes exactly one commit on `main`, which
  makes one commit equal one deploy. That keeps `git log main` readable as a
  deploy history and makes a revert a single-commit operation.
- **Never merge on a red build.** `typecheck`, `lint`, and `build` must pass
  before a PR is opened, and must still pass before it is merged.

## Current State

**Branch naming:** `trpl-<n>-<kebab-description>`, derived from the PR title
(e.g. `TRPL-7` + "Fix cross-midnight card ordering" becomes
`trpl-7-fix-cross-midnight-card-ordering`). Lowercase, non-alphanumeric runs
collapsed to a single hyphen.

**Repo settings** (verified, GitHub): squash merge enabled; merge commits and
rebase merges are also enabled but are not to be used. `delete_branch_on_merge`
is on. The merge step still passes `--delete-branch`, because the repo setting
only removes the *remote* branch — the flag also cleans up your local copy.

**Skills** automate both halves of this, and are the intended way to ship:

- `/just-create-pr` — branches if needed, runs the checks, commits, pushes, and
  opens the PR. Stops there. Use when the change wants eyes on it first.
- `/create-and-push-pr` — same, then waits for the remote checks, squash merges
  to `main`, and deletes the branch. Use when the change is verified and you
  want it in now.

**Checks:** the app is not run or built mid-work; the build is the gate right
before a PR goes up.

```bash
npm run typecheck && npm run lint && npm run build
```

`npm run verify` (pure axis/layout logic) is cheap and worth running when a PR
touches `src/components/board/geometry.ts` or the canvas. `npm run verify:axis`
drives a real browser and needs a running dev server plus a seeded test
database — run it by hand when a PR touches axis alignment, not on every PR.
See the Verification section of the README.

**Reverting a bad deploy:** because merges are squashed, `git revert <sha>` on
`main` undoes exactly one PR. Prefer that over rolling back at the host, so the
code and the live site never disagree.

## Migrations

Vercel runs `vercel-build` in preference to `build`, and that script applies
the checked-in Drizzle migrations before Next compiles:

```json
"vercel-build": "drizzle-kit migrate && next build --turbopack"
```

Order matters more than it looks. Drizzle names every column explicitly in its
`SELECT`s, so a deploy that ships code ahead of its migration does not degrade
gracefully — it 500s on every read of that table until the column exists.
Running the migration inside the build also fails closed: no `DATABASE_URL`,
no build, no deploy.

**`DATABASE_URL` must be present in Vercel's _Build_ environment**, not only
Runtime. They are separate scopes in the project settings, and a build-scope
omission stays invisible until the migrate step runs.

**Never point `drizzle-kit push` at production.** `push` diffs the live
database against the schema and will drop a column the schema no longer
mentions. It is a dev convenience against a disposable database. The
production path is `db:generate` (checked in, reviewed as part of the PR) then
`db:migrate` (applied in order, journal-tracked).

Local `npm run build` deliberately does *not* migrate, so the PR check gate
never touches a database.

## The flow

### 1. Preflight

```bash
git status --porcelain=v1 -uall && git branch --show-current
```

If a PR already exists for the branch (`gh pr view --json url` succeeds), reuse
it rather than opening a second one.

### 2. Ticket number

```bash
gh pr list --state all --limit 200 --json title --jq '.[].title'
```

Parse `\[TRPL-([0-9]+)\]` out of every title, take the highest, add 1. If no PR
has ever been opened, use `TRPL-1`.

### 3. Uncommitted changes

If the tree is dirty, decide explicitly whether to commit everything in the
working tree or only the files touched in this session. Don't guess — a dirty
tree often holds unrelated work in progress, and sweeping it into a deploy is
only recoverable by a revert.

### 4. Branch

If on `main`, branch before committing anything. Uncommitted changes carry over
with the switch.

```bash
git switch -c trpl-<n>-<kebab-description>
```

### 5. Checks

```bash
npm run typecheck && npm run lint && npm run build
```

**Do not open a PR on a red build.** Fix it, or report the failure and stop.

### 6. Commit and push

First line of the commit message is the PR title verbatim. The body explains
**why**, not what the diff already shows. End with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

```bash
git push -u origin trpl-<n>-<kebab-description>
```

### 7. Open the PR

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

Stop here if the change wants eyes on it before it goes live.

### 8. Wait for the remote checks

A green local build is not proof the host can build it — a missing production
env var fails only there.

```bash
gh pr checks --watch
```

- Passes: continue.
- Fails: **stop.** Report which check failed and why. Do not merge, and do not
  reach for `--admin` to get around it.
- No checks configured at all: say so explicitly, then continue. The merge went
  in on the local build alone and the operator should know that.

### 9. Squash merge

```bash
gh pr merge --squash --delete-branch
```

`--squash` is mandatory: one PR becomes one commit on `main`, so one commit
equals one deploy and a revert is a single-commit operation.

### 10. Sync local

```bash
git checkout main && git pull
```

### 11. Report

The PR URL, the squashed commit sha on `main`, and a plain statement of what is
now live. If the deploy needs anything that is not in the repo — a new env var,
a Drizzle migration to push against Neon, a Google OAuth console change — say so
unprompted. A green merge with a missing env var is a broken site.
