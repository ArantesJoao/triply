/**
 * Shapes and constants shared by the server and the browser.
 *
 * Kept separate from `src/server/board.ts` deliberately: that module imports
 * the database client, so a client component importing a *value* from it —
 * `BACKLOG_KEY`, say — would pull the entire Postgres driver into the browser
 * bundle. Nothing in this file may import anything server-only.
 */

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
  position: number;
  columns: ColumnDTO[];
};

export type BoardDTO = {
  id: string;
  title: string;
  activeCityId: string | null;
  shareToken: string;
  revision: number;
  updatedAt: string;
  cities: CityDTO[];
};
