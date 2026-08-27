/**
 * Time handling for the shared axis.
 *
 * The prototype stored raw "HH:MM" strings and guessed that an hour below 5
 * meant "actually tomorrow". That guess is wrong as soon as a day legitimately
 * starts at 04:00, and it silently reordered the Sunday Anfield return (00:47).
 *
 * Here, a scheduled item is `(time, dayOffset)` relative to its column's own
 * date: `dayOffset` is how many midnights have passed since that date. Every
 * axis calculation runs on the resulting absolute minute count, so nothing
 * downstream ever has to infer intent from the clock face.
 */

export const MINUTES_PER_DAY = 1440;

/** Drops onto the axis round to this, per the spec's 15-minute snapping. */
export const SNAP_MINUTES = 15;

/** 04:00 — the default top of the axis. */
export const DEFAULT_AXIS_START = 4 * 60;

/** 26:00, i.e. 02:00 the following day — the default bottom of the axis. */
export const DEFAULT_AXIS_END = 26 * 60;

/** Never render an axis shorter than this, so a near-empty day still reads. */
const MIN_AXIS_SPAN = 8 * 60;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/* --------------------------------------------------------------------- *
 * Calendar dates.
 *
 * A column's `date` is a plain `YYYY-MM-DD` civil date, not an instant — the
 * 8th of the month in Amsterdam is the 8th wherever the trip is being read
 * from. So these never touch UTC: `toISOString()` on a local midnight lands on
 * the previous day for anyone west of Greenwich, which would quietly shift a
 * whole itinerary by one.
 * --------------------------------------------------------------------- */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  // Rejects the well-formed impossibilities — 2026-02-31 round-trips to March.
  return toISODate(parseISODate(value)) === value;
}

/** `YYYY-MM-DD` → a Date at local midnight. */
function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** A local Date → `YYYY-MM-DD`. */
function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today, in the reader's own timezone. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** `YYYY-MM-DD` shifted by whole days. Handles month and year ends. */
export function addDaysISO(value: string, days: number): string {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/**
 * The column title a date suggests — "Friday 28".
 *
 * Pinned to `en-US` rather than the reader's locale on purpose: this becomes a
 * stored column *title*, shared with everyone on the trip, so it must not come
 * out as "qui. 27" for whoever happened to create the day. It is a default the
 * user can overwrite, not a rendered date.
 */
export function formatDayTitle(value: string): string {
  const date = parseISODate(value);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${weekday} ${date.getDate()}`;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

/**
 * Accepts "9:5", "09:05", "9.05", "0905" and normalises to "09:05".
 * Returns null for anything that isn't a time, including "" and null.
 */
export function normaliseTime(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const compact = raw.match(/^(\d{1,2})[:.\s]?(\d{2})$/);
  if (!compact) return null;

  const hours = Number(compact[1]);
  const minutes = Number(compact[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Absolute minutes from the column's own midnight, or null if unscheduled. */
export function toAxisMinutes(
  time: string | null | undefined,
  dayOffset: number | null | undefined = 0,
): number | null {
  if (!isValidTime(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return (dayOffset ?? 0) * MINUTES_PER_DAY + hours * 60 + minutes;
}

/** Inverse of {@link toAxisMinutes}. Negative input clamps to 00:00 day 0. */
export function fromAxisMinutes(total: number): {
  time: string;
  dayOffset: number;
} {
  const clamped = Math.max(0, Math.round(total));
  const dayOffset = Math.floor(clamped / MINUTES_PER_DAY);
  const withinDay = clamped % MINUTES_PER_DAY;
  const hours = Math.floor(withinDay / 60);
  const minutes = withinDay % 60;
  return {
    time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    dayOffset,
  };
}

export function snapMinutes(total: number, step = SNAP_MINUTES): number {
  return Math.round(total / step) * step;
}

/** "19:00", and "00:47" for a post-midnight position. 24h per spec §40. */
export function formatAxisLabel(total: number): string {
  return fromAxisMinutes(total).time;
}

/**
 * Label for an axis gridline. Past midnight the bare clock face is ambiguous,
 * so those hours carry a +1 marker.
 */
export function formatAxisTick(total: number): string {
  const { time, dayOffset } = fromAxisMinutes(total);
  return dayOffset > 0 ? `${time}⁺` : time;
}

export type Scheduled = {
  time: string | null;
  dayOffset: number;
  durationMin: number | null;
};

/**
 * The axis window shared by every timed column in a city.
 *
 * Computed once per city — not per column — because identical geometry across
 * columns is what makes 19:00 line up everywhere. Starts from the default
 * 06:00–02:00 window and only ever grows, so adding an early item shifts every
 * column together rather than desynchronising them.
 */
export function axisRangeFor(items: Scheduled[]): {
  start: number;
  end: number;
} {
  let start = DEFAULT_AXIS_START;
  let end = DEFAULT_AXIS_END;

  for (const item of items) {
    const at = toAxisMinutes(item.time, item.dayOffset);
    if (at == null) continue;
    if (at < start) start = at;
    const finish = at + (item.durationMin ?? 0);
    if (finish > end) end = finish;
  }

  // Round outward to whole hours so gridlines land on the hour.
  start = Math.floor(start / 60) * 60;
  end = Math.ceil(end / 60) * 60;

  if (end - start < MIN_AXIS_SPAN) end = start + MIN_AXIS_SPAN;
  return { start, end };
}

/** Whole-hour gridline positions across an axis window. */
export function hourTicks(start: number, end: number): number[] {
  const ticks: number[] = [];
  for (let at = Math.ceil(start / 60) * 60; at <= end; at += 60) ticks.push(at);
  return ticks;
}
