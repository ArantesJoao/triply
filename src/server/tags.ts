import { and, eq, inArray, sql } from 'drizzle-orm';

import { cities, columns, db, items, trips } from '@/lib/db';

import { resolveCity } from './board';
import { badRequest, conflict, notFound } from './errors';
import { touchTrip } from './trips';

/**
 * Tag management, scoped to one city.
 *
 * There is no tag table: a tag exists exactly as long as some item's `tags`
 * array contains it. So renaming and deleting are array rewrites over the
 * city's items, done in one statement rather than a read-modify-write per card
 * — a city with eighty activities would otherwise be eighty round trips, and
 * anything landing in between would be clobbered.
 *
 * The style maps on the trip (`tagColors` / `tagIcons`) stay trip-wide even
 * though the tags themselves are per-city: two cities that both use "food" are
 * meant to render the same. That asymmetry is what the bookkeeping below is
 * for — a tag's styling only disappears once the tag has left the whole trip.
 */

/** Item tags are stored trimmed and lower-cased, so a lookup has to match. */
function normalise(tag: string): string {
  const clean = tag.trim().toLowerCase();
  if (!clean) throw badRequest('A tag name cannot be empty.');
  return clean;
}

/** Restricts a rewrite to one city without joining, which UPDATE can't do. */
const inCity = (cityId: string) =>
  inArray(
    items.columnId,
    db
      .select({ id: columns.id })
      .from(columns)
      .where(eq(columns.cityId, cityId)),
  );

/** Containment rather than `= ANY`, so an untagged card is never rewritten. */
const carries = (tag: string) => sql`${items.tags} @> ARRAY[${tag}]::text[]`;

/** Does any card anywhere on this trip still carry the tag? */
async function usedInTrip(tripId: string, tag: string): Promise<boolean> {
  const [row] = await db
    .select({ id: items.id })
    .from(items)
    .innerJoin(columns, eq(columns.id, items.columnId))
    .innerJoin(cities, eq(cities.id, columns.cityId))
    .where(and(eq(cities.tripId, tripId), carries(tag)))
    .limit(1);
  return Boolean(row);
}

/**
 * Settles a tag's colour and icon overrides after its cards have changed.
 *
 * `alias` (a rename's new name) inherits them, so a renamed tag keeps looking
 * like itself. The old entries are dropped only once no city uses the tag any
 * more: deleting London's "food" must not strip the colour off Barcelona's.
 */
async function settleTagStyles(tripId: string, tag: string, alias?: string) {
  const [trip] = await db
    .select({ tagColors: trips.tagColors, tagIcons: trips.tagIcons })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!trip) throw notFound('Trip');

  const tagColors = { ...(trip.tagColors ?? {}) };
  const tagIcons = { ...(trip.tagIcons ?? {}) };
  let dirty = false;

  if (alias) {
    // Never overwrite what the new name already has — someone chose that.
    if (tag in tagColors && !(alias in tagColors)) {
      tagColors[alias] = tagColors[tag];
      dirty = true;
    }
    if (tag in tagIcons && !(alias in tagIcons)) {
      tagIcons[alias] = tagIcons[tag];
      dirty = true;
    }
  }

  // Only worth a usage query when there is something to drop.
  const styled = tag in tagColors || tag in tagIcons;
  if (styled && !(await usedInTrip(tripId, tag))) {
    delete tagColors[tag];
    delete tagIcons[tag];
    dirty = true;
  }

  if (dirty) {
    await db
      .update(trips)
      .set({ tagColors, tagIcons })
      .where(eq(trips.id, tripId));
  }
}

/**
 * Renames a tag across one city's cards.
 *
 * Merging onto an existing tag is refused rather than silently folding the two
 * together: the fold is not reversible, and an accidental one loses the
 * distinction between two sets of cards. The same name living in another city
 * is fine — tags are per-city.
 */
export async function renameCityTag(
  tripId: string,
  cityRef: string,
  tag: string,
  name: string,
) {
  const from = normalise(tag);
  const to = normalise(name);
  const city = await resolveCity(tripId, cityRef);

  // Submitting a rename form untouched (or with different casing) would
  // otherwise trip the "already in use" guard against the tag itself.
  if (from === to) return { tag: to, updated: 0 };

  const [clash] = await db
    .select({ id: items.id })
    .from(items)
    .where(and(inCity(city.id), carries(to)))
    .limit(1);
  if (clash) {
    throw conflict(
      `This city already has a "${to}" tag. Pick a name that is free, or delete one of them first.`,
    );
  }

  const changed = await db
    .update(items)
    .set({
      tags: sql`array_replace(${items.tags}, ${from}, ${to})`,
      updatedAt: new Date(),
    })
    .where(and(inCity(city.id), carries(from)))
    .returning({ id: items.id });

  await settleTagStyles(tripId, from, to);
  await touchTrip(tripId);

  return { tag: to, updated: changed.length };
}

/** Strips a tag from every card in one city, leaving other cities alone. */
export async function deleteCityTag(
  tripId: string,
  cityRef: string,
  tag: string,
) {
  const name = normalise(tag);
  const city = await resolveCity(tripId, cityRef);

  const changed = await db
    .update(items)
    .set({
      tags: sql`array_remove(${items.tags}, ${name})`,
      updatedAt: new Date(),
    })
    .where(and(inCity(city.id), carries(name)))
    .returning({ id: items.id });

  await settleTagStyles(tripId, name);
  await touchTrip(tripId);

  return { tag: name, updated: changed.length };
}
