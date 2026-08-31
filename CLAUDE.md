# trip.ly — working agreements

## Never run the dev server or the app

**Do not run `next dev`, `npm run dev`, `npm start`, or anything else that
serves this project.** Not to verify a change, not to "make sure it still
works", not in the background.

The dev server is mine, it is already running, and it is always on **port
3103** — the same port as `npm run dev`, `npm start`, `AUTH_URL` and
`NEXT_PUBLIC_APP_URL`. There is one port for this app and that is it. Starting
your own server collides with mine on it, and killing "a" dev server kills
*mine*.

**Do not kill node processes.** You cannot tell yours from mine.

### `npm run build` is fine now, and it is the PR gate again

It used to hang forever, which is why it was banned. `next build` and the dev
server shared `.next/`, and a build begins by emptying that directory: the dev
server held `.next/trace` open, the unlink failed with `EPERM`, Windows left
the file delete-pending, and Next's `recursiveDelete` retried that error
forever — its backoff counter is post-incremented, so its own retry bound never
trips. The build hung before compiling anything, printed nothing, never exited,
and corrupted the `.next/` my browser was being served from.

`next.config.ts` now picks `distDir` by phase: the dev server keeps `.next`, a
local `next build` and `next start` get `.next-build` to themselves, and Vercel
still uses `.next`. A local build cannot touch anything of mine any more, so
`/just-create-pr` and `/create-and-push-pr` run it as a check again.

It takes about half a minute on this machine — the old ban was about the
hang, not the cost. Run it at the gate anyway, not after every edit.

### Verify a change in progress like this

- `npx tsc --noEmit` for types
- `npx eslint <changed files>` for lint
- Read the code

That is enough while you are still working. If a change genuinely needs to be
seen running, say so and let me look — I have the app open.

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
