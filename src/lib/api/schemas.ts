import { z } from 'zod';

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

export type CityInputBody = z.infer<typeof cityInput>;
export type ColumnInputBody = z.infer<typeof columnInput>;
export type ItemInputBody = z.infer<typeof itemInput>;
