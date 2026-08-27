# trip.ly — working agreements

## Never run builds, dev servers, or the app

**Do not run `next build`, `next dev`, `npm run build`, `npm run dev`, `npm start`, or anything else that compiles or serves this project.** Not to verify a change, not to "make sure it still works", not in the background.

The dev server is mine and it is already running. When you start your own:

- `next build` writes into the same `.next/` the dev server is serving from and corrupts it, so my browser goes blank
- killing "a" dev server kills *mine*
- builds here take many minutes and produce nothing either of us needed

**Do not kill node processes.** You cannot tell yours from mine.

**Do not delete `.next/`** unless I ask, or unless you already broke it.

### The one exception: opening a PR

`npm run build` is allowed at exactly one moment — the check gate in
`/just-create-pr` and `/create-and-push-pr`, immediately before the PR goes up.
A red build must never reach `main`, and that is the only place it gets caught
locally.

This is still the only time. Not mid-edit, not to verify a change, not "while
I'm here anyway". If you are not about to open a PR, the rule above applies
unchanged.

It will disturb the dev server I have running, so say so when you run it — I
will restart it.

### Verify like this instead

- `npx tsc --noEmit` for types
- `npx eslint <changed files>` for lint
- Read the code

That is enough. If a change genuinely needs to be seen running, say so and let me look — I have the app open.

## Scope

Do what was asked. A request for a component is not a request for a full verification pass, a refactor of neighbouring code, or a background task queue. Finish the thing, say what you changed, stop.
