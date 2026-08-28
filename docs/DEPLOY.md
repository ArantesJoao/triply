# trip.ly — Deploys

## Charter

> Agents MUST NOT modify the Charter without explicit operator approval.

- **`main` is the release branch.** Every commit on `main` deploys to
  <https://planwithtriply.com>. A merge is a deploy — treat it that way.
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

**Production:** <https://planwithtriply.com>, hosted on Vercel and deployed
from `main`. Every squashed commit on `main` triggers a production deploy; a PR
gets a preview deploy on its own URL. Google OAuth is registered against
`https://planwithtriply.com` (origin) and
`https://planwithtriply.com/api/auth/callback/google` (redirect), so a change of
domain needs an entry added in the Google console before the first sign-in on
it.

**Branch naming:** `trpl-<n>-<kebab-description>`, derived from the PR title
(e.g. `TRPL-7` + "Fix cross-midnight card ordering" becomes
`trpl-7-fix-cross-midnight-card-ordering`). Lowercase, non-alphanumeric runs
collapsed to a single hyphen.

**Repo settings** (verified, GitHub): squash merge is the *only* method
enabled — merge commits and rebase merges are disabled at the repository, so
GitHub enforces the one-PR-one-commit rule rather than leaving it to whoever
is clicking the button. `delete_branch_on_merge` is on. The merge step still passes `--delete-branch`, because the repo setting
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

Vercel runs `vercel-build` in preference to `build`. That script
(`scripts/vercel-build.mjs`) applies the checked-in Drizzle migrations before
Next compiles — but **only on production deploys**.

Preview deploys are deliberately excluded. On this plan preview and production
share one `DATABASE_URL`, so a preview build that migrated would alter the
production schema from an unmerged branch.

### Changing the schema

**This is the only path. There is no other way the schema changes** — not
locally, not on production.

```bash
# 1. edit src/lib/db/schema.ts
npm run db:generate     # writes drizzle/NNNN_name.sql + meta/NNNN_snapshot.json
                        #   and appends the entry to meta/_journal.json
npm run db:migrate      # apply it to your own database
git add drizzle          # all three files — the .sql alone is not a migration
```

Then open the PR as usual. Merging to `main` deploys, `vercel-build` runs
`drizzle-kit migrate` before Next compiles, and the column exists before any
code that selects it is served. Nothing else to run, nothing to remember at
deploy time.

Two things to hold on to, because both fail quietly:

**Never hand-write a file into `drizzle/`.** `drizzle-kit migrate` works from
`meta/_journal.json`, not from the directory listing, so a `.sql` you wrote
yourself is invisible to it: the deploy reports success and the column never
appears. Only `db:generate` writes that journal entry and the snapshot the
*next* migration will diff against.

**Never `drizzle-kit push`.** Beyond what it will drop (below), a pushed
database ends up with a schema and no journal — so `migrate` has no idea what
has already been applied. Recovering from that is the baselining dance two
sections down, and it is not something to walk into on purpose. `push` is not
wired up as an npm script for this reason.

Order matters more than it looks. Drizzle names every column explicitly in its
`SELECT`s, so a deploy that ships code ahead of its migration does not degrade
gracefully — it 500s on every read of that table until the column exists.
Running the migration inside the build also fails closed: no `DATABASE_URL`,
no build, no deploy.

**`DATABASE_URL` must be present in Vercel's _Build_ environment**, not only
Runtime. They are separate scopes in the project settings, and a build-scope
omission stays invisible until the migrate step runs.

**What `push` does, for the record.** It diffs the live database against the
schema and will drop a column the schema no longer mentions — which is why it
is not used here at all, against production or anything else. The path is
`db:generate` (checked in, reviewed as part of the PR) then `db:migrate`
(applied in order, journal-tracked) — the same two commands you ran locally.

Local `npm run build` deliberately does *not* migrate, so the PR check gate
never touches a database.

### Baselining a pushed database

Legacy safety net, not part of the flow above. It exists because databases here
predate the first migration; a database created the documented way never needs
it.

`drizzle-kit migrate` reads only the newest row of `drizzle.__drizzle_migrations`
and applies every migration newer than it. A database created with
`drizzle-kit push` has no such table, so `migrate` sees no rows, replays `0000`
against tables that already exist, and the transaction aborts. The failure
looks like a build that connects, spins on "applying migrations...", then exits
1 a second later — drizzle's own error is lost because it renders over the
spinner line and the log collector keeps only the last frame.

`scripts/vercel-build.mjs` handles this itself, before calling `migrate`. If
the journal is empty *and* `public.trip` already exists, it records `0000` as
applied without executing it, so `migrate` starts at `0001`. On a fresh
database the sentinel is absent and `migrate` builds everything from `0000` as
normal; on an already-journalled one it does nothing. There is no manual step.

Generated migrations should still be written idempotently where Postgres
allows it (`ADD COLUMN IF NOT EXISTS`), so a database that drifted ahead via
`push` does not wedge the deploy.

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
