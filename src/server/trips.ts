import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import {
  cities,
  columns,
  db,
  items,
  tripMembers,
  trips,
  users,
} from '@/lib/db';
import { newShareToken, newTripId } from '@/lib/ids';
import { DAY_START_HELP, isValidDayStart } from '@/lib/time';
import {
  tagColorIndexByName,
  tagColorNameByIndex,
  type TagColorName,
} from '@/lib/tag-colors';

import { badRequest, conflict, notFound } from './errors';

/**
 * Bumps the trip's revision. Clients poll it to notice other people's edits
 * without re-fetching the whole board, which is enough for four friends on a
 * last-write-wins board.
 */
export async function touchTrip(tripId: string) {
  await db
    .update(trips)
    .set({ revision: sql`${trips.revision} + 1`, updatedAt: new Date() })
    .where(eq(trips.id, tripId));
}

export async function listTripsForUser(userId: string) {
  const rows = await db
    .select({
      id: trips.id,
      title: trips.title,
      revision: trips.revision,
      updatedAt: trips.updatedAt,
      createdBy: trips.createdBy,
      role: tripMembers.role,
    })
    .from(tripMembers)
    .innerJoin(trips, eq(trips.id, tripMembers.tripId))
    .where(eq(tripMembers.userId, userId))
    .orderBy(desc(trips.updatedAt));

  if (rows.length === 0) return [];

  const tripIds = rows.map((row) => row.id);

  // Per-trip counts for the trip list cards, in two round trips rather than
  // one per trip.
  const [cityCounts, memberCounts] = await Promise.all([
    db
      .select({ tripId: cities.tripId, cities: count() })
      .from(cities)
      .where(inArray(cities.tripId, tripIds))
      .groupBy(cities.tripId),
    db
      .select({ tripId: tripMembers.tripId, members: count() })
      .from(tripMembers)
      .where(inArray(tripMembers.tripId, tripIds))
      .groupBy(tripMembers.tripId),
  ]);

  const cityByTrip = new Map(cityCounts.map((r) => [r.tripId, r.cities]));
  const memberByTrip = new Map(memberCounts.map((r) => [r.tripId, r.members]));

  return rows.map((row) => ({
    ...row,
    isOwner: row.createdBy === userId,
    cityCount: cityByTrip.get(row.id) ?? 0,
    memberCount: memberByTrip.get(row.id) ?? 0,
  }));
}

export async function createTrip(userId: string, title: string) {
  const clean = title.trim() || 'Untitled trip';
  const id = newTripId();

  await db.transaction(async (tx) => {
    await tx.insert(trips).values({
      id,
      title: clean,
      shareToken: newShareToken(),
      createdBy: userId,
    });
    await tx
      .insert(tripMembers)
      .values({ tripId: id, userId, role: 'owner' })
      .onConflictDoNothing();
  });

  return id;
}

export async function getTripMeta(tripId: string) {
  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!trip) throw notFound('Trip');
  return trip;
}

export async function updateTrip(
  tripId: string,
  patch: {
    title?: string;
    activeCityId?: string | null;
    tagColors?: Record<string, number>;
    tagIcons?: Record<string, string>;
    dayStartMin?: number;
  },
) {
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (patch.title !== undefined) {
    const clean = patch.title.trim();
    if (!clean) throw conflict('A trip needs a title.');
    set.title = clean;
  }

  if (patch.tagColors !== undefined) {
    set.tagColors = patch.tagColors;
  }

  if (patch.tagIcons !== undefined) {
    set.tagIcons = patch.tagIcons;
  }

  if (patch.dayStartMin !== undefined) {
    // 400, matching `updateCity` — the same value rejected for the same
    // reason must not come back as two different statuses.
    if (!isValidDayStart(patch.dayStartMin)) throw badRequest(DAY_START_HELP);
    set.dayStartMin = patch.dayStartMin;
  }

  if (patch.activeCityId !== undefined) {
    if (patch.activeCityId) {
      const [city] = await db
        .select({ id: cities.id })
        .from(cities)
        .where(and(eq(cities.id, patch.activeCityId), eq(cities.tripId, tripId)))
        .limit(1);
      if (!city) throw notFound('City');
    }
    set.activeCityId = patch.activeCityId;
  }

  set.revision = sql`${trips.revision} + 1`;
  await db.update(trips).set(set).where(eq(trips.id, tripId));
}

/**
 * Pins one tag's colour and/or icon, merging into the existing maps.
 *
 * Deliberately not a variant of {@link updateTrip}, which replaces `tagColors`
 * wholesale: the browser sends a merged copy of the map (it holds the board in
 * memory), but a caller working one tag at a time would wipe every other
 * override by omission. Passing null for either field drops the override, so
 * the tag falls back to its hashed colour / keyword-guessed icon.
 */
export async function setTagStyle(
  tripId: string,
  tag: string,
  patch: { color?: TagColorName | null; icon?: string | null },
) {
  // Item tags are stored trimmed and lower-cased, so an override keyed
  // "Food" would never match the "food" on the cards.
  const key = tag.trim().toLowerCase();
  if (!key) throw conflict('A tag name cannot be empty.');

  const [trip] = await db
    .select({ tagColors: trips.tagColors, tagIcons: trips.tagIcons })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!trip) throw notFound('Trip');

  const tagColors = { ...(trip.tagColors ?? {}) };
  const tagIcons = { ...(trip.tagIcons ?? {}) };

  if (patch.color !== undefined) {
    if (patch.color === null) delete tagColors[key];
    else tagColors[key] = tagColorIndexByName(patch.color) ?? 0;
  }

  if (patch.icon !== undefined) {
    if (patch.icon === null) delete tagIcons[key];
    else tagIcons[key] = patch.icon;
  }

  await db
    .update(trips)
    .set({
      tagColors,
      tagIcons,
      revision: sql`${trips.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));

  return {
    tag: key,
    color: key in tagColors ? tagColorNameByIndex(tagColors[key]) : null,
    icon: key in tagIcons ? tagIcons[key] : null,
  };
}

export async function deleteTrip(tripId: string) {
  // Cities/columns/items/members/invites all cascade from the trip row.
  await db.delete(trips).where(eq(trips.id, tripId));
}

export async function rotateShareToken(tripId: string) {
  const shareToken = newShareToken();
  await db.update(trips).set({ shareToken }).where(eq(trips.id, tripId));
  return shareToken;
}

/** Lightweight poll target: has anything on this trip changed? */
export async function getTripRevision(tripId: string) {
  const [row] = await db
    .select({ revision: trips.revision, updatedAt: trips.updatedAt })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!row) throw notFound('Trip');
  return row;
}

/** Total item count, used by the trip list and the empty-state decisions. */
export async function countTripItems(tripId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(items)
    .innerJoin(columns, eq(columns.id, items.columnId))
    .innerJoin(cities, eq(cities.id, columns.cityId))
    .where(eq(cities.tripId, tripId));
  return row?.total ?? 0;
}

export async function getUserById(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}
