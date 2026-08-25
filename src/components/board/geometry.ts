/**
 * Board geometry.
 *
 * Every timed column in a city renders with these exact numbers, which is what
 * makes 19:00 sit at an identical Y across all of them. The header and tray
 * heights are fixed for the same reason: if the unscheduled tray grew with its
 * contents it would push that column's axis down and break the alignment.
 */

/** Vertical scale of the axis. */
export const PX_PER_HOUR = 64;
export const PX_PER_MINUTE = PX_PER_HOUR / 60;

/** Fixed — identical in every timed column. */
export const COLUMN_HEADER_PX = 42;

/** Fixed, scrolls internally when it overflows. */
export const TRAY_PX = 88;

/** Left gutter carrying the hour labels. */
export const AXIS_GUTTER_PX = 52;

export const TIMED_COLUMN_PX = 264;
export const LIST_COLUMN_PX = 280;

/** Breathing room between stacked cards, in px. */
export const CARD_GAP_PX = 6;

/**
 * Cap on side-by-side lanes. Beyond this, cards get too narrow to read; the
 * packer keeps them non-overlapping either way.
 */
export const MAX_LANES = 3;

export const minutesToPx = (minutes: number) => minutes * PX_PER_MINUTE;
export const pxToMinutes = (px: number) => px / PX_PER_MINUTE;
