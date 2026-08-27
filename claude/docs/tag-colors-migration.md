# Tag Colours — DB Migration

## What changed

Added a `tag_colors` column to the `trip` table:

```sql
ALTER TABLE "trip" ADD COLUMN "tag_colors" jsonb DEFAULT '{}'::jsonb;
```

## Schema (Drizzle)

```ts
// src/lib/db/schema.ts — trips table
tagColors: jsonb('tag_colors').$type<Record<string, number>>().default({}),
```

## Shape

```json
{ "food": 2, "hotel": 5 }
```

Keys are lowercase tag names; values are palette indices 0–7 (see
`src/lib/tag-colors.ts` for the palette). Tags absent from the map fall back
to a deterministic string-hash colour.

## Deploy safety

This migration is **additive-only**:

- New nullable (defaults to `'{}'`) column — no destructive changes.
- Existing rows get `'{}'` (empty map), meaning all tags keep their hash colour
  until someone picks a different one.
- No index changes required.
- Works with Vercel's `drizzle-kit push` deploy step out of the box. Neon
  branching (preview deploys) inherits the column automatically once the
  production branch has it.

## How it was applied (dev, 2026-08-25)

```sh
npx drizzle-kit push --force
```

Also cleaned up stale columns (`cover_url`, `status`, `participant_ids` on
`item`) and re-asserted primary key constraints. These were leftover schema
drift from earlier prototyping and had no live data in them.

## Related files

| File | Role |
|---|---|
| `src/lib/tag-colors.ts` | 8-hue palette + `tagColor(tag, overrides?)` |
| `src/lib/board-model.ts` | `BoardDTO.tagColors` |
| `src/server/board.ts` | Reads `trip.tagColors` into the board DTO |
| `src/server/trips.ts` | `updateTrip` persists `tagColors` |
| `src/lib/api/schemas.ts` | `updateTripBody.tagColors` validation |
| `src/components/board/store.tsx` | `TripRecord.tagColors` + `setTagColor()` |
| `src/components/board/item-dialog.tsx` | `TagColorPicker` UI |
