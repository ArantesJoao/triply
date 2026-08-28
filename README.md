# trip.ly

A shared trip-planning board. Each city gets a tab; each city holds timed day
columns that share **one** vertical time axis, plus plain lists like a Backlog.
Built to be opened on a phone mid-trip.

**Live at [planwithtriply.com](https://planwithtriply.com)** — hosted on Vercel,
deployed from `main`.

- **Stack** — Next.js 15 (App Router) · React 19 · Tailwind v4 · TypeScript
- **Database** — NeonDB (serverless Postgres) via Drizzle ORM
- **Auth** — Auth.js v5, Google sign-in only
- **Drag & drop** — dnd-kit (mouse, touch and keyboard)
- **Hosting** — Vercel, with Vercel Analytics
- **Programmatic access** — a documented REST API and an MCP server

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where it comes from |
| --- | --- |
| `DATABASE_URL` | [Neon console](https://console.neon.tech) → your project → connection string. Use the **pooled** one (host contains `-pooler`). |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | [Google Cloud console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client ID (Web application). |
| `AUTH_SECRET` | `npx auth secret` |
| `SEED_OWNER_EMAIL` | The Google address that should own the seeded trip. |

The Google client needs these entries:

```
Authorised JavaScript origin:  http://localhost:3103
Authorised redirect URI:       http://localhost:3103/api/auth/callback/google
```

Production uses the same client, with the live origin listed alongside:

```
Authorised JavaScript origin:  https://planwithtriply.com
Authorised redirect URI:       https://planwithtriply.com/api/auth/callback/google
```

### 3. Create the schema

```bash
npm run db:migrate   # apply the checked-in migrations, in order
```

Migrations are the only way this schema ever changes — locally and in
production. `drizzle-kit push` is deliberately not wired up as a script: a
pushed database has no migration journal, so the next deploy has nothing to
apply migrations *from*. See [docs/DEPLOY.md](docs/DEPLOY.md#changing-the-schema).

### 4. Seed the October 2026 trip

```bash
npm run seed          # skips if it already exists
npm run seed -- --force   # delete and recreate it
```

This creates one trip owned by `SEED_OWNER_EMAIL`: **London** fully populated
from the real itinerary, plus Amsterdam, Barcelona, Edinburgh and Glasgow as
empty placeholders with a Backlog each. That account doesn't need to have
signed in yet — the Google login attaches to the seeded user on first sign-in.

### 5. Run

```bash
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | Time and lane-packing checks (see below) |
| `npm run verify:axis` | Browser check of the shared axis (needs a running dev server) |
| `npm run db:generate` | Generate a SQL migration from the schema |
| `npm run db:migrate` | Apply the checked-in migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run seed` | Seed the October 2026 trip |

## Data model

`Trip` is the tenant. A signed-in user reaches only the trips they're a member
of, either because they created one or because they were invited.

```
user ──< trip_member >── trip ──< city ──< column ──< item
                          └──< trip_invite   (by email, claimed on first sign-in)
user ──< api_token                           (REST + MCP access)
```

| Field | Notes |
| --- | --- |
| `column.timed` | `true` = renders against the clock; `false` = plain ordered list |
| `column.date` | The day's calendar date, when known |
| `item.time` | `"HH:MM"` 24h, or `null` = unscheduled (sits in the day's tray) |
| `item.dayOffset` | Midnights past the column's date. `1` for anything after midnight |
| `item.durationMin` | Optional; renders the card as a block rather than a point |
| `item.tags` | Free-form, lowercase. No taxonomy |

Cities and columns each carry a `key` — a readable handle unique within their
parent — so the API accepts `/cities/london` as well as an id. The key
`backlog` is reserved and cannot be deleted in any city.

## Programmatic access

Full docs are served at **`/docs`**. Create a token under **Settings**, then:

```bash
curl https://planwithtriply.com/api/trips -H "Authorization: Bearer triply_…"
```

A token carries exactly its owner's access — the trips they own or were
invited to, nothing more. Only the SHA-256 hash is stored.

The headline endpoint is bulk import, because the normal case is "here's a day
plan I already wrote, create it":

```bash
curl -X POST https://planwithtriply.com/api/trips/TRIP_ID/import \
  -H "Authorization: Bearer triply_…" \
  -H "content-type: application/json" \
  -d '{ "cities": [{ "title": "Barcelona", "columns": [ ... ] }] }'
```

### MCP

The same operations are exposed as MCP tools, so Claude can edit the board
directly. Three steps:

1. Open [planwithtriply.com/settings](https://planwithtriply.com/settings),
   type a name under **API tokens**, and press **Create**. Copy the token — it
   is shown once.
2. Run this, with your own token in place of `triply_…`:

   ```bash
   claude mcp add --transport http triply https://planwithtriply.com/api/mcp \
     --header "Authorization: Bearer triply_…"
   ```

3. Confirm with `claude mcp list` — `triply` should read as connected.

Claude Desktop uses the same server: **Settings → Connectors → Add custom
connector**, URL `https://planwithtriply.com/api/mcp`. The same instructions,
with a copy button, are on `/settings` in the app.

20 tools, including `list_trips`, `get_board`, `import_cities`, `move_item`,
`set_tag_style` and the per-city `rename_tag` / `delete_tag` — full CRUD over
trips, cities, columns and items. Arguments go through the same zod schemas as
the REST API. Member management and the share link are deliberately left out:
those are owner decisions, made in the app.

## Implementation notes

This is a rebuild. The previous version was a single-file vanilla-JS prototype
that validated the idea but had four specific problems; each is addressed
structurally here rather than by being careful.

**Cross-midnight times.** The prototype stored `"HH:MM"` strings and guessed
that an hour below 5 meant "tomorrow". A day that genuinely starts at 04:00
breaks that. Here a scheduled item is `(time, dayOffset)` relative to its
column's date, and every axis calculation runs on the resulting absolute minute
count — see `src/lib/time.ts`.

**Axis collision.** The prototype cascaded overlapping cards downward using a
hardcoded card height, so adding a tags row made overlap visibly worse. Here
each card reports its *measured* rendered height via `ResizeObserver`, that
measurement becomes its span in minutes, and `src/lib/layout.ts` lane-packs
those spans. Nothing in the layout path knows how tall a card is. Growth is
monotone, so the measure/pack cycle settles instead of oscillating.

**Full-board re-renders.** Every edit re-rendered everything and lost scroll
position. State is now normalised flat records and components subscribe to a
single record through `useSyncExternalStore`, so editing one title re-renders
that card alone — see `src/components/board/store.tsx`.

**Hand-rolled dragging.** Pointer math plus `elementFromPoint` left cards
rendering detached from their column. Now dnd-kit, with a dedicated grip handle
so taps and scrolls still behave on touch.

### The shared time axis

The one behaviour worth protecting: 19:00 must sit at an identical Y in every
timed column. Three things enforce it, in `src/components/board/geometry.ts`
and `board-canvas.tsx`:

- the axis window is computed **once per city**, not per column;
- every column renders at the same `PX_PER_HOUR`;
- the column header and unscheduled tray are **fixed heights**, so a tray with
  four cards in it can't push its own column's axis down.

Two checks guard this.

`npm run verify` covers the pure logic: cross-midnight ordering, axis-window
growth, and 2000 randomised layouts asserting no two cards ever share a lane
and a moment.

`npm run verify:axis` drives a real browser against a running dev server and
asserts the rendered result — that every axis starts at the same Y and is the
same height, that each wall-clock time appearing in several columns sits at an
identical offset in all of them, that no card's box intersects another's, and
that the page hydrates without a mismatch. It signs in by minting the same JWT
session cookie Auth.js would issue, so no Google round trip is needed.

```bash
docker run -d --name triply-db \
  -e POSTGRES_PASSWORD=triply -e POSTGRES_DB=triply \
  -p 5433:5432 postgres:16-alpine

cp .env.example .env.test   # DATABASE_URL=postgresql://postgres:triply@localhost:5433/triply
ENV_FILE=.env.test npm run db:migrate
ENV_FILE=.env.test npm run seed
ENV_FILE=.env.test npm run verify:axis -- http://localhost:3103
```

Pointing `DATABASE_URL` at a non-Neon host selects the node-postgres driver
automatically, so this needs no code changes.

## Multi-user

Everyone on a trip edits the same board, last-write-wins. Open boards poll a
revision counter and pull a fresh snapshot only when it moves — and never
mid-save, so an in-flight edit can't be clobbered by a stale snapshot.

## Reference

`docs/build-spec.md` and `docs/visual-identity.md` hold the product and design
specs this was built from. `docs/DEPLOY.md` is the PR and squash-merge
convention every change lands through.
