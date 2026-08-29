# trip.ly — working agreements

## Never run builds, dev servers, or the app

**Do not run `next build`, `next dev`, `npm run build`, `npm run dev`, `npm start`, or anything else that compiles or serves this project.** Not to verify a change, not to "make sure it still works", not in the background.

The dev server is mine and it is already running. When you start your own:

- `next build` writes into the same `.next/` the dev server is serving from and corrupts it, so my browser goes blank
- killing "a" dev server kills *mine*
- builds here take many minutes and produce nothing either of us needed

**Do not kill node processes.** You cannot tell yours from mine.

**Do not delete `.next/`** unless I ask, or unless you already broke it.

### No exceptions, including opening a PR

There used to be one: the check gate in `/just-create-pr` and
`/create-and-push-pr`. It is gone. On this machine `next build` wedges before
it compiles anything — it contends with my dev server for `.next/`, which
Windows locks — so it eats a long stretch of wall clock, breaks the dev server
it collided with, and reports nothing either way.

The build now runs in exactly one place: Vercel, from
`scripts/vercel-build.mjs`, on deploy. That means nothing compiles a change
before it lands on `main`, so a PR report must say plainly that the deploy is
the first real build.

### Verify like this instead

- `npx tsc --noEmit` for types
- `npx eslint <changed files>` for lint
- Read the code

That is enough. If a change genuinely needs to be seen running, say so and let me look — I have the app open.

## The schema changes one way

Drizzle, controlled migrations, no other way — `npm run db:generate`, commit
all three files it touches under `drizzle/`, then `npm run db:migrate`. Never
hand-write a migration file (`migrate` reads the journal, not the directory,
so it is silently skipped) and never `drizzle-kit push` (it leaves a database
with no journal, which is how this repo got into trouble once already).
Production applies the same migrations from `scripts/vercel-build.mjs` on
deploy. Details in [docs/DEPLOY.md](docs/DEPLOY.md#changing-the-schema).

## Scope

Do what was asked. A request for a component is not a request for a full verification pass, a refactor of neighbouring code, or a background task queue. Finish the thing, say what you changed, stop.
