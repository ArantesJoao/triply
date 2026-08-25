# trip.ly

A shared trip-planning board. Each city gets a tab; each city holds timed day
columns that share **one** vertical time axis, plus plain lists like a Backlog.
Built to be opened on a phone mid-trip.

- **Stack** — Next.js 15 (App Router) · React 19 · Tailwind v4 · TypeScript
- **Database** — NeonDB (serverless Postgres) via Drizzle ORM
- **Auth** — Auth.js v5, Google sign-in only
- **Drag & drop** — dnd-kit (mouse, touch and keyboard)
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
Authorised JavaScript origin:  http://localhost:3000
Authorised redirect URI:       http://localhost:3000/api/auth/callback/google
```

Add your production origin and callback alongside them when you deploy.

### 3. Create the schema

```bash
npm run db:push      # push the schema straight to Neon
# or: npm run db:migrate   to apply the checked-in SQL migration
```

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
| `npm run db:generate` | Generate a SQL migration from the schema |
| `npm run db:push` | Push the schema directly (fastest for dev) |
| `npm run db:migrate` | Apply migrations |
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
curl https://your-host/api/trips -H "Authorization: Bearer triply_…"
```

A token carries exactly its owner's access — the trips they own or were
invited to, nothing more. Only the SHA-256 hash is stored.

The headline endpoint is bulk import, because the normal case is "here's a day
plan I already wrote, create it":

```bash
curl -X POST https://your-host/api/trips/TRIP_ID/import \
  -H "Authorization: Bearer triply_…" \
  -H "content-type: application/json" \
  -d '{ "cities": [{ "title": "Barcelona", "columns": [ ... ] }] }'
```

### MCP

The same operations are exposed as MCP tools, so Claude can edit the board
directly:

```bash
claude mcp add --transport http triply https://your-host/api/mcp \
  --header "Authorization: Bearer triply_…"
```

16 tools, including `list_trips`, `get_board`, `import_cities`, `move_item`.

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

Run `npm run verify` to check the time and packing invariants, including 2000
randomised layouts asserting no two cards ever share a lane and a moment.

## Multi-user

Everyone on a trip edits the same board, last-write-wins. Open boards poll a
revision counter and pull a fresh snapshot only when it moves — and never
mid-save, so an in-flight edit can't be clobbered by a stale snapshot.

## Reference

`docs/build-spec.md` and `docs/visual-identity.md` hold the product and design
specs this was built from.
