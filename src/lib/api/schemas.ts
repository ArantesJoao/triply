import { z } from 'zod';

import { TAG_COLOR_NAMES, TAG_PALETTE_SIZE } from '@/lib/tag-colors';
import { TAG_ICON_KEYS } from '@/lib/tag-icons';
import { normaliseTime } from '@/lib/time';

/**
 * Field names and types deliberately mirror the build spec's data model, so an
 * LLM handed the schema can generate correct requests with no translation
 * layer. `dayOffset` and `durationMin` are the two additions: the first makes
 * post-midnight times unambiguous, the second is the spec's optional duration
 * nice-to-have. Both default sensibly when omitted.
 */

/**
 * Validated with the same parser the app uses, so an out-of-range value like
 * "99:99" is rejected outright. A looser pattern would let it through and then
 * normalise it to null, silently unscheduling the card — an agent has no way
 * to notice its time was dropped.
 */
const timeString = z.string().refine((value) => normaliseTime(value) !== null, {
  message: 'Use a valid 24-hour time, e.g. "19:30".',
});

export const itemInput = z.object({
  title: z.string().max(300).optional(),
  time: timeString.nullable().optional(),
  dayOffset: z.int().min(0).max(6).optional(),
  durationMin: z.int().min(0).max(24 * 60).nullable().optional(),
  blurb: z.string().max(4000).optional(),
  tags: z.array(z.string().max(60)).max(30).optional(),
});

export const columnInput = z.object({
  /** The spec's seed JSON uses `id` for the handle; `key` is the same thing. */
  id: z.string().max(80).optional(),
  key: z.string().max(80).optional(),
  title: z.string().min(1).max(200),
  timed: z.boolean().optional(),
  date: z.iso.date().nullable().optional(),
  items: z.array(itemInput).max(500).optional(),
});

export const cityInput = z.object({
  id: z.string().max(80).optional(),
  key: z.string().max(80).optional(),
  title: z.string().min(1).max(200),
  columns: z.array(columnInput).max(100).optional(),
});

export const createTripBody = z.object({
  title: z.string().min(1).max(200),
});

export const updateTripBody = z.object({
  title: z.string().min(1).max(200).optional(),
  activeCityId: z.string().nullable().optional(),
  tagColors: z
    .record(z.string(), z.int().min(0).max(TAG_PALETTE_SIZE - 1))
    .optional(),
  tagIcons: z
    .record(z.string(), z.union([z.enum(TAG_ICON_KEYS), z.literal('')]))
    .optional(),
});

export const updateCityBody = z.object({
  title: z.string().min(1).max(200).optional(),
  position: z.int().min(0).optional(),
});

export const updateColumnBody = z.object({
  title: z.string().min(1).max(200).optional(),
  timed: z.boolean().optional(),
  date: z.iso.date().nullable().optional(),
  position: z.int().min(0).optional(),
});

export const updateItemBody = itemInput.extend({
  columnId: z.string().optional(),
  position: z.int().min(0).optional(),
});

export const moveItemBody = z.object({
  columnId: z.string(),
  time: timeString.nullable().optional(),
  dayOffset: z.int().min(0).max(6).optional(),
  /** Full id order of the destination column after the drop. */
  order: z.array(z.string()).max(500).optional(),
});

export const reorderBody = z.object({
  order: z.array(z.string()).max(500),
});

export const importBoardBody = z.object({
  cities: z.array(cityInput).min(1).max(50),
  /** Delete every existing city first. Off by default. */
  replace: z.boolean().optional(),
});

export const inviteBody = z.object({
  email: z.email(),
});

export const createTokenBody = z.object({
  name: z.string().min(1).max(80),
});

export const tagStyleBody = z.object({
  /** Palette name, or null to fall back to the deterministic hash colour. */
  color: z.enum(TAG_COLOR_NAMES).nullable().optional(),
  /** Icon key, `''` for no icon, or null to fall back to the keyword guess. */
  icon: z
    .union([z.enum(TAG_ICON_KEYS), z.literal('')])
    .nullable()
    .optional(),
});

/** Tags carry no id, so both the old and the new name travel in the body. */
export const renameTagBody = z.object({
  tag: z.string().min(1).max(60),
  name: z.string().min(1).max(60),
});

export type CityInputBody = z.infer<typeof cityInput>;
export type ColumnInputBody = z.infer<typeof columnInput>;
export type ItemInputBody = z.infer<typeof itemInput>;
export type TagStyleBody = z.infer<typeof tagStyleBody>;

/* ------------------------------------------------------------------ *
 * MCP tool arguments
 *
 * The JSON Schemas in the MCP route are what the *model* reads; these are
 * what the server trusts. Without them tool arguments reach the service
 * layer unvalidated, and a bad time like "99:99" normalises to null —
 * silently unscheduling a card, which an agent has no way to notice.
 *
 * Strict objects: an undeclared argument is a mistake worth surfacing, not
 * something to drop on the floor. The nested item/column/city payloads stay
 * lenient, since the REST API shares them.
 * ------------------------------------------------------------------ */

/** An id, or a human-readable handle like "london" / "backlog". */
const ref = z.string().min(1).max(80);
const tripId = z.string().min(1).max(80);

export const toolArgs = {
  list_trips: z.strictObject({}),

  get_board: z.strictObject({ tripId }),

  get_city: z.strictObject({ tripId, city: ref }),

  create_trip: z.strictObject({ title: z.string().min(1).max(200) }),

  update_trip: z.strictObject({
    tripId,
    title: z.string().min(1).max(200).optional(),
    activeCityId: z.string().max(80).nullable().optional(),
  }),

  delete_trip: z.strictObject({
    tripId,
    confirm: z.literal(true, {
      error: 'Pass confirm: true to delete a trip and everything on it.',
    }),
  }),

  set_tag_style: z.strictObject({
    tripId,
    tag: z.string().min(1).max(60),
    ...tagStyleBody.shape,
  }),

  rename_tag: z.strictObject({ tripId, city: ref, ...renameTagBody.shape }),

  delete_tag: z.strictObject({
    tripId,
    city: ref,
    tag: z.string().min(1).max(60),
  }),

  import_cities: z.strictObject({ tripId, ...importBoardBody.shape }),

  create_city: z.strictObject({ tripId, ...cityInput.shape }),

  update_city: z.strictObject({
    tripId,
    city: ref,
    title: z.string().min(1).max(200),
  }),

  delete_city: z.strictObject({ tripId, city: ref }),

  create_column: z.strictObject({ tripId, city: ref, ...columnInput.shape }),

  update_column: z.strictObject({
    tripId,
    column: ref,
    title: z.string().min(1).max(200).optional(),
    timed: z.boolean().optional(),
    date: z.iso.date().nullable().optional(),
  }),

  delete_column: z.strictObject({ tripId, column: ref }),

  create_item: z.strictObject({ tripId, column: ref, ...itemInput.shape }),

  update_item: z.strictObject({
    tripId,
    itemId: z.string().min(1).max(80),
    ...itemInput.shape,
  }),

  move_item: z.strictObject({
    tripId,
    itemId: z.string().min(1).max(80),
    columnId: ref,
    time: timeString.nullable().optional(),
    dayOffset: z.int().min(0).max(6).optional(),
  }),

  delete_item: z.strictObject({
    tripId,
    itemId: z.string().min(1).max(80),
  }),
} as const;

export type ToolName = keyof typeof toolArgs;
