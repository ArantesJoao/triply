/**
 * Board geometry.
 *
 * Every timed column in a city renders with these exact numbers, which is what
 * makes 19:00 sit at an identical Y across all of them. The header height is
 * fixed for the same reason: if any column were taller before its axis, that
 * column's axis would start lower and the alignment breaks.
 */

/**
 * Vertical scale of the axis.
 *
 * Chosen so a card with a two-line title and a tags row occupies rather less
 * than the 45 minutes that separates most stops on a real itinerary — which
 * keeps the common case to a single lane. Lane packing still guarantees no
 * overlap when stops genuinely collide; this only decides how often that has
 * to happen.
 */
export const PX_PER_HOUR = 192;
export const PX_PER_MINUTE = PX_PER_HOUR / 60;

/** Fixed — identical in every timed column. */
export const COLUMN_HEADER_PX = 42;

/** Left gutter carrying the hour labels. */
export const AXIS_GUTTER_PX = 52;

/**
 * Gap between a column header and the top of its content.
 *
 * Every column's content starts at `COLUMN_HEADER_PX + AXIS_TOP_GAP_PX` — days,
 * lists, and the add-column button alike — which is what keeps their tops on
 * one line. The axis gutter reaches the same origin by stacking the two, since
 * only the header part of it may be an opaque sticky cover: hour labels are
 * centred on their gridline, so a cover running down to the origin clips the
 * first label in half.
 */
export const AXIS_TOP_GAP_PX = 16;

export const TIMED_COLUMN_PX = 264;
export const LIST_COLUMN_PX = 280;

/** Breathing room between stacked cards, in px. */
export const CARD_GAP_PX = 6;

/**
 * The three heights an axis card can render at.
 *
 * A card is given the slot its *time* earns it — never the other way round —
 * so when the slot is short the card has to give something up rather than
 * overflow it. These are the exact rendered heights of the three densities in
 * `plan-card.tsx`, which is why every line height there is pinned in px: the
 * arithmetic below has to be true, not approximately true.
 *
 *   full    16 (py-2)   + 15 time + 18 title + 6 (mt-1.5) + 22 chip = 77
 *   stacked 16 (py-2)   + 15 time + 18 title                       = 49
 *   compact 12 (py-1.5) + 18 (time and title on one line)          = 30
 *
 * Anything shorter than `CARD_COMPACT_PX` is not a card any more, so that is
 * also the floor on a slot's height.
 */
export const CARD_FULL_PX = 77;
export const CARD_STACKED_PX = 49;
export const CARD_COMPACT_PX = 30;

export type CardDensity = 'full' | 'stacked' | 'compact';

/** The richest layout that fits in `height` px. */
export const densityFor = (height: number): CardDensity =>
  height >= CARD_FULL_PX
    ? 'full'
    : height >= CARD_STACKED_PX
      ? 'stacked'
      : 'compact';

/**
 * Height of an empty column's prompt on desktop.
 *
 * Sized to the Backlog's empty state, which is the tallest of them and the one
 * with no say in the matter — its height is whatever its illustration, copy,
 * example tags and CTA add up to. The empty timed day matches it deliberately,
 * so a city with nothing in it yet reads as one row of equals rather than a
 * short box beside a tall one.
 *
 * Backlog at `size="sm"`: 64 padding + 128 illustration + 63 copy + 48 tags
 * + 40 button + 3x10 gaps.
 */
export const EMPTY_PROMPT_PX = 373;

export const minutesToPx = (minutes: number) => minutes * PX_PER_MINUTE;
export const pxToMinutes = (px: number) => px / PX_PER_MINUTE;
