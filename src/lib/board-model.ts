/**
 * Shapes and constants shared by the server and the browser.
 *
 * Kept separate from `src/server/board.ts` deliberately: that module imports
 * the database client, so a client component importing a *value* from it —
 * `BACKLOG_KEY`, say — would pull the entire Postgres driver into the browser
 * bundle. Nothing in this file may import anything server-only.
 */

import type { TravelMode } from '@/lib/maps';

/** The column key that may never be deleted, in any city (build spec §2). */
export const BACKLOG_KEY = 'backlog';

export type ItemDTO = {
  id: string;
  title: string;
  /** "HH:MM" 24h, or null when unscheduled. */
  time: string | null;
  /** Midnights past the column's own date; 1 for anything after midnight. */
  dayOffset: number;
  /** Optional block length in minutes. Null renders as a point on the axis. */
  durationMin: number | null;
  blurb: string;
  tags: string[];
  /** Ordered stops of a route through this activity; empty for most cards. */
  stops: string[];
  /** How the route is travelled. Null means walking. */
  travelMode: TravelMode | null;
  /**
   * Whether this card is a real, visitable place — checked only when `stops`
   * is empty, to decide whether the day map should try to geocode the title.
   * Null (every card written before this field existed included) behaves
   * exactly like false. See `IS_PLACE_HELP` in `@/lib/maps` for the
   * human-facing wording, and `itemProperties.isPlace` in the MCP route for
   * the fuller guidance an editing agent gets.
   */
  isPlace: boolean | null;
  /**
   * The Google Maps link for `stops`, derived rather than stored — the server
   * builds it because it knows the city, and it is read-only: sending it back
   * in a write changes nothing.
   */
  mapsUrl: string | null;
  position: number;
};

export type ColumnDTO = {
  id: string;
  key: string;
  title: string;
  /** true = renders against the shared time axis; false = plain ordered list. */
  timed: boolean;
  date: string | null;
  position: number;
  items: ItemDTO[];
};

export type CityDTO = {
  id: string;
  key: string;
  title: string;
  /**
   * Minutes past midnight where this city's axis opens, or null to inherit the
   * trip's. Resolve it with `dayStartFor` — null is "inherit", not midnight.
   */
  dayStartMin: number | null;
  position: number;
  columns: ColumnDTO[];
};

export type BoardDTO = {
  id: string;
  title: string;
  activeCityId: string | null;
  shareToken: string;
  /** Per-tag colour overrides: `{ [tagName]: paletteIndex }`. */
  tagColors: Record<string, number>;
  /** Per-tag icon overrides: `{ [tagName]: iconKey }`; `''` means no icon. */
  tagIcons: Record<string, string>;
  /** Minutes past midnight where the axis opens, for cities that don't override. */
  dayStartMin: number;
  revision: number;
  updatedAt: string;
  cities: CityDTO[];
};
