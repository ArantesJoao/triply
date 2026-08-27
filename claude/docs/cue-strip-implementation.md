# UI Cue Strip — Implementation Plan

> Design spec: `06 UI CUE STRIP` (see image reference)

## What it is

A two-row bar below the board header that **replaces** the old `CityTabs`.

**Row 1** — City tabs · + City · Filter toggle · Add to Trip button
**Row 2** — Collapsible tag filter tray (grid-rows animation)

## Tag colour system

Tags get deterministic colours from an 8-hue palette. The same tag always
renders the same hue everywhere (plan cards, item dialog, filter tray) unless
the user has overridden it via the colour picker in the item dialog.

Palette: Indigo · Teal · Amber · Rose · Sky · Violet · Emerald · Orange

### How colours are resolved

1. **Per-trip overrides** — The `trip.tag_colors` jsonb column stores
   `{ tagName: paletteIndex }`. If a tag appears here, its palette index wins.
2. **Hash fallback** — A deterministic string hash picks one of the 8 hues.

Each hue ships light **and** dark values. The `useDarkMode()` hook (backed by
a `MutationObserver` on `<html>.dark`) selects the right set at render time.

### How users change a tag's colour

The item dialog shows a **Tag colours** section below the tag input whenever
the card has tags. Each tag gets a row of 8 palette dots; tapping one calls
`store.setTagColor(tag, index)` which PATCHes the trip's `tagColors` map.
The change is trip-wide and instant (optimistic update).

**Files:**
- `src/lib/tag-colors.ts` — palette + `tagColor(tag, overrides?)` helper
- `src/lib/use-dark-mode.ts` — `useDarkMode()` hook
- `src/lib/db/schema.ts` — `trips.tagColors` jsonb column
- `src/components/board/item-dialog.tsx` — `TagColorPicker` component

## Components

### CueStrip (`src/components/board/cue-strip.tsx`)

| Row | Contents |
| --- | -------- |
| 1 | City tabs (Building2 20px, r=12, brand border when active) · `+ City` dashed button · spacer · Filter toggle (badge shows count when filters active) · "Add to Trip" primary button |
| 2 | Collapsible via `grid-rows-[0fr]` → `grid-rows-[1fr]` — wrapping flex of TagChips + "Clear all" link |

### TagChip (`src/components/ui/chip.tsx`)

- `tagColors` prop (optional `Record<string, number>`) — per-trip overrides
- `color` prop (optional `TagColor`) — direct colour override
- Auto-derived from label via `tagColor(label, tagColors)` when neither is set
- r=12 (`rounded-xl`), 8px dot, 16px ×, transparent border (default) / coloured border (selected)
- Compact `sm` variant for inline plan-card use

### Tag filtering

- OR logic: a card matches if it has **any** of the active filter tags
- Non-matching cards dimmed (`opacity-40`), not hidden
- Filters reset on city switch
- "Clear all" button in the tray

## Files changed

| File | Change |
| ---- | ------ |
| `src/lib/tag-colors.ts` | **New** — 8-hue palette, `tagColor(tag, overrides?)`, `tagColorByIndex()` |
| `src/lib/use-dark-mode.ts` | **New** — `MutationObserver`-based dark mode hook |
| `src/lib/db/schema.ts` | Added `tagColors` jsonb column to `trips` |
| `src/lib/board-model.ts` | Added `tagColors` to `BoardDTO` |
| `src/lib/api/schemas.ts` | Added `tagColors` to `updateTripBody` |
| `src/server/board.ts` | Returns `tagColors` in the board DTO |
| `src/server/trips.ts` | Persists `tagColors` in `updateTrip` |
| `src/components/ui/chip.tsx` | Coloured chips via inline styles + `useDarkMode()` |
| `src/components/board/store.tsx` | `TripRecord.tagColors` + `setTagColor()` mutation |
| `src/components/board/cue-strip.tsx` | Two-row strip with collapsible filter tray |
| `src/components/board/plan-card.tsx` | Passes `tagColors` to inline `TagChip` |
| `src/components/board/item-dialog.tsx` | `TagColorPicker` + passes `tagColors` to `TagInput` |
| `src/components/board/board-app.tsx` | Mounts `CueStrip`, removed `CityTabs` |
| `src/components/board/board-canvas.tsx` | Accepts `tagFilters`, `addRequest`; removed tray |
| `src/components/board/timed-column.tsx` | Dims non-matching cards; removed tray |
| `src/components/board/list-column.tsx` | Dims non-matching cards; removed tray |
| `src/components/board/geometry.ts` | Removed all tray constants |
| `src/app/globals.css` | Removed old CSS-var tag colour rules |
| `src/app/icon.svg` | **New** — SVG favicon |
| `src/app/layout.tsx` | `icons` metadata |
| `src/app/t/[tripId]/loading.tsx` | Updated skeleton to match new layout |
