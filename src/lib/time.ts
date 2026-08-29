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

/**
 * 08:00 — where a day starts until someone says otherwise.
 *
 * Only a default. A trip carries its own `dayStartMin` and any city may
 * override it, because "the day starts at 08:00" is a claim about the people
 * on the trip rather than about the clock: the same board is read by someone
 * already out at 06:00 and by someone who surfaces at 11:00, and a fixed top
 * of the axis makes one of them scroll past dead hours every time. Nothing is
 * lost by guessing late — an earlier item pulls the axis up on its own.
 */
export const DEFAULT_DAY_START_MIN = 8 * 60;

/** A day may start anywhere from midnight to noon… */
export const MAX_DAY_START_MIN = 12 * 60;

/** …on the half hour. Finer than that is fiddly and buys nothing. */
export const DAY_START_STEP_MINUTES = 30;

/** How much of the clock an axis covers, measured from the day's start. */
export const AXIS_SPAN_MINUTES = 22 * 60;

/** Never render an axis shorter than this, so a near-empty day still reads. */
const MIN_AXIS_SPAN = 8 * 60;

/** One wording for every rejection, so the API never contradicts itself. */
export const DAY_START_HELP =
  'dayStartMin must be minutes past midnight, on the half hour, between 0 (00:00) and 720 (12:00).';

export function isValidDayStart(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_DAY_START_MIN &&
    value % DAY_START_STEP_MINUTES === 0
  );
}

/**
 * The day start in force for a city — its own override, or the trip's.
 *
 * `null` on a city means "inherit", not "midnight", so every read of a city's
 * day start goes through here rather than reaching for the field.
 */
export function dayStartFor(
  tripDayStart: number,
  cityDayStart: number | null | undefined,
): number {
  return cityDayStart ?? tripDayStart;
}

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
 * columns is what makes 19:00 line up everywhere. Opens at the city's day
 * start, runs {@link AXIS_SPAN_MINUTES} from there, and from then on only ever
 * grows, so an early item shifts every column together rather than
 * desynchronising them.
 *
 * That growth is why a day start can never hide anything: set it to 10:00 with
 * an 07:00 breakfast already on the board and the window still opens at 07:00.
 * It decides where an *empty* day begins, which is the whole of what it is for.
 */
export function axisRangeFor(
  items: Scheduled[],
  dayStartMin: number = DEFAULT_DAY_START_MIN,
): {
  start: number;
  end: number;
} {
  let start = dayStartMin;
  let end = dayStartMin + AXIS_SPAN_MINUTES;

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

/**
 * "Fri 9" — the short form the date chips wear.
 *
 * Display only, unlike {@link formatDayTitle}, which becomes a stored column
 * title and so has to be pinned to one locale for everyone on the trip. These
 * two are rendered locally and never persisted, so they are free to read the
 * way a date reads — but they are still pinned, to `en-GB`, because the board
 * writes its dates day-before-month everywhere else.
 */
export function formatDateShort(value: string): string {
  const date = parseISODate(value);
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  return `${weekday} ${date.getDate()}`;
}

/** "Friday 9 October 2026" — the line that resolves a chip tap in full. */
export function formatDateLong(value: string): string {
  return parseISODate(value).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "October 2026" — the calendar's month heading. */
export function formatMonthTitle(value: string): string {
  return parseISODate(value).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The Monday-first grid a month is drawn on: always six weeks of dates, so the
 * calendar never changes height as you page through it.
 */
export function monthGrid(monthAnchor: string): string[] {
  const anchor = parseISODate(monthAnchor);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  // getDay() is Sunday-first; the grid is Monday-first.
  const lead = (first.getDay() + 6) % 7;

  const start = new Date(first);
  start.setDate(first.getDate() - lead);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return toISODate(day);
  });
}

/** Same year and month? Used to grey out the grid's leading and trailing days. */
export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** `YYYY-MM-DD` shifted by whole months, clamped to the month's last day. */
export function addMonthsISO(value: string, months: number): string {
  const date = parseISODate(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toISODate(date);
}

/* --------------------------------------------------------------------- *
 * Clock arithmetic for the time picker.
 * --------------------------------------------------------------------- */

/** The stepper's grain: every tap is half an hour. */
export const TIME_STEP_MINUTES = 30;

/**
 * Every activity takes some time. "None" was an option once and it only ever
 * meant "nobody said" — which drew a zero-height block on the axis and made a
 * real half hour look like an omission. New cards start here instead.
 */
export const DEFAULT_DURATION_MIN = 30;

/** Offered when the trip has nothing scheduled to learn from yet. */
export const FALLBACK_TIMES = ['09:00', '12:00', '14:00', '19:00'];

/**
 * Steps a time by whole minutes, wrapping the clock — 23:30 → 00:00 and back.
 * Wrapping rather than clamping is what makes the stepper usable for a
 * late-night activity without a trip through the whole day.
 */
export function stepTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total = hours * 60 + mins + minutes;
  const wrapped = ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(
    wrapped % 60,
  ).padStart(2, '0')}`;
}

/**
 * The five times a trip actually starts things at, most-used first, padded out
 * of {@link FALLBACK_TIMES} when there isn't enough history to tell.
 *
 * Computed from what is already scheduled rather than from a fixed list,
 * because "the times this trip uses" is a property of the trip: a city break
 * and a festival weekend do not share a 09:00.
 */
export function commonStartTimes(
  scheduled: (string | null | undefined)[],
  limit = 5,
): string[] {
  const counts = new Map<string, number>();
  for (const time of scheduled) {
    if (!isValidTime(time)) continue;
    counts.set(time, (counts.get(time) ?? 0) + 1);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([time]) => time);

  for (const fallback of FALLBACK_TIMES) {
    if (ranked.length >= limit) break;
    if (!ranked.includes(fallback)) ranked.push(fallback);
  }

  return ranked.slice(0, limit).sort();
}
