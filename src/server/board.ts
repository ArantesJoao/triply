import { and, asc, eq, inArray, max, sql } from 'drizzle-orm';

import { cities, columns, db, items, trips } from '@/lib/db';
import {
  newCityId,
  newColumnId,
  newItemId,
  slugify,
  uniqueSlug,
} from '@/lib/ids';
import { BACKLOG_KEY } from '@/lib/board-model';
import type { BoardDTO, CityDTO, ColumnDTO, ItemDTO } from '@/lib/board-model';
import { normaliseTime } from '@/lib/time';

import { badRequest, conflict, notFound } from './errors';
import { touchTrip } from './trips';

// Shapes and the reserved backlog key live in a client-safe module so browser
// code can import them without pulling in the database driver.
export {
  BACKLOG_KEY,
  type BoardDTO,
  type CityDTO,
  type ColumnDTO,
  type ItemDTO,
} from '@/lib/board-model';

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/**
 * The whole trip as one nested document. Three queries regardless of size —
 * cities, then their columns, then their items — assembled in memory rather
 * than issuing a query per city.
 */
export async function getBoard(tripId: string): Promise<BoardDTO> {
  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!trip) throw notFound('Trip');

  const cityRows = await db
    .select()
    .from(cities)
    .where(eq(cities.tripId, tripId))
    .orderBy(asc(cities.position), asc(cities.createdAt));

  const cityIds = cityRows.map((c) => c.id);

  const columnRows = cityIds.length
    ? await db
        .select()
        .from(columns)
        .where(inArray(columns.cityId, cityIds))
        .orderBy(asc(columns.position), asc(columns.createdAt))
    : [];

  const columnIds = columnRows.map((c) => c.id);

  const itemRows = columnIds.length
    ? await db
        .select()
        .from(items)
        .where(inArray(items.columnId, columnIds))
        .orderBy(asc(items.position), asc(items.createdAt))
    : [];

  const itemsByColumn = new Map<string, ItemDTO[]>();
  for (const row of itemRows) {
    const list = itemsByColumn.get(row.columnId) ?? [];
    list.push({
      id: row.id,
      title: row.title,
      time: row.time,
      dayOffset: row.dayOffset,
      durationMin: row.durationMin,
      blurb: row.blurb,
      tags: row.tags ?? [],
      position: row.position,
    });
    itemsByColumn.set(row.columnId, list);
  }

  const columnsByCity = new Map<string, ColumnDTO[]>();
  for (const row of columnRows) {
    const list = columnsByCity.get(row.cityId) ?? [];
    list.push({
      id: row.id,
      key: row.key,
      title: row.title,
      timed: row.timed,
      date: row.date,
      position: row.position,
      items: itemsByColumn.get(row.id) ?? [],
    });
    columnsByCity.set(row.cityId, list);
  }

  return {
    id: trip.id,
    title: trip.title,
    activeCityId: trip.activeCityId,
    shareToken: trip.shareToken,
    revision: trip.revision,
    updatedAt: trip.updatedAt.toISOString(),
    cities: cityRows.map((city) => ({
      id: city.id,
      key: city.key,
      title: city.title,
      position: city.position,
      columns: columnsByCity.get(city.id) ?? [],
    })),
  };
}

export async function getCity(
  tripId: string,
  cityRef: string,
): Promise<CityDTO> {
  const board = await getBoard(tripId);
  const city = board.cities.find(
    (c) => c.id === cityRef || c.key === cityRef,
  );
  if (!city) throw notFound('City');
  return city;
}

/* ------------------------------------------------------------------ *
 * Reference resolution — ids and human-readable keys both work, so an
 * agent can say "london" without looking the id up first.
 * ------------------------------------------------------------------ */

export async function resolveCity(tripId: string, ref: string) {
  const [row] = await db
    .select()
    .from(cities)
    .where(
      and(
        eq(cities.tripId, tripId),
        sql`(${cities.id} = ${ref} OR ${cities.key} = ${ref})`,
      ),
    )
    .limit(1);
  if (!row) throw notFound('City');
  return row;
}

export async function resolveColumn(tripId: string, ref: string) {
  const [row] = await db
    .select({ column: columns, city: cities })
    .from(columns)
    .innerJoin(cities, eq(cities.id, columns.cityId))
    .where(
      and(
        eq(cities.tripId, tripId),
        sql`(${columns.id} = ${ref} OR ${columns.key} = ${ref})`,
      ),
    )
    .limit(1);
  if (!row) throw notFound('Column');
  return row;
}

export async function resolveItem(tripId: string, itemId: string) {
  const [row] = await db
    .select({ item: items, column: columns, city: cities })
    .from(items)
    .innerJoin(columns, eq(columns.id, items.columnId))
    .innerJoin(cities, eq(cities.id, columns.cityId))
    .where(and(eq(cities.tripId, tripId), eq(items.id, itemId)))
    .limit(1);
  if (!row) throw notFound('Item');
  return row;
}

/* ------------------------------------------------------------------ *
 * Cities
 * ------------------------------------------------------------------ */

export type CityInput = {
  title: string;
  key?: string;
  /** Omit to get a lone empty Backlog, matching the spec's placeholder cities. */
  columns?: ColumnInput[];
};

export async function createCity(tripId: string, input: CityInput) {
  const title = input.title?.trim();
  if (!title) throw badRequest('A city needs a title.');

  const existing = await db
    .select({ key: cities.key, position: cities.position })
    .from(cities)
    .where(eq(cities.tripId, tripId));

  const key = uniqueSlug(
    slugify(input.key || title, 'city'),
    existing.map((c) => c.key),
  );
  const position = existing.reduce((n, c) => Math.max(n, c.position + 1), 0);
  const cityId = newCityId();

  const columnInputs = input.columns?.length
    ? input.columns
    : [{ title: 'Backlog', key: BACKLOG_KEY, timed: false, items: [] }];

  await db.transaction(async (tx) => {
    await tx
      .insert(cities)
      .values({ id: cityId, tripId, key, title, position });

    await insertColumnTree(tx, cityId, columnInputs);

    // First city in a trip becomes the active tab.
    await tx
      .update(trips)
      .set({
        activeCityId: sql`COALESCE(${trips.activeCityId}, ${cityId})`,
        revision: sql`${trips.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(trips.id, tripId));
  });

  return cityId;
}

export async function updateCity(
  tripId: string,
  cityRef: string,
  patch: { title?: string; position?: number },
) {
  const city = await resolveCity(tripId, cityRef);
  const set: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const clean = patch.title.trim();
    if (!clean) throw badRequest('A city needs a title.');
    set.title = clean;
  }
  if (patch.position !== undefined) set.position = patch.position;

  if (Object.keys(set).length) {
    await db.update(cities).set(set).where(eq(cities.id, city.id));
    await touchTrip(tripId);
  }
  return city.id;
}

/**
 * Deletes a city and everything under it. A trip is allowed to end up with no
 * cities — that state renders the "Ready for a new city?" placeholder — so the
 * only care needed is moving the active tab off the deleted city.
 */
export async function deleteCity(tripId: string, cityRef: string) {
  const city = await resolveCity(tripId, cityRef);

  await db.transaction(async (tx) => {
    await tx.delete(cities).where(eq(cities.id, city.id));

    const [trip] = await tx
      .select({ activeCityId: trips.activeCityId })
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1);

    if (trip?.activeCityId === city.id) {
      const [next] = await tx
        .select({ id: cities.id })
        .from(cities)
        .where(eq(cities.tripId, tripId))
        .orderBy(asc(cities.position), asc(cities.createdAt))
        .limit(1);
      await tx
        .update(trips)
        .set({ activeCityId: next?.id ?? null })
        .where(eq(trips.id, tripId));
    }

    await tx
      .update(trips)
      .set({ revision: sql`${trips.revision} + 1`, updatedAt: new Date() })
      .where(eq(trips.id, tripId));
  });
}

/* ------------------------------------------------------------------ *
 * Columns
 * ------------------------------------------------------------------ */

export type ColumnInput = {
  title: string;
  key?: string;
  /** Also accepted as `id` in import payloads, mirroring the spec's seed JSON. */
  id?: string;
  timed?: boolean;
  date?: string | null;
  items?: ItemInput[];
};

export async function createColumn(
  tripId: string,
  cityRef: string,
  input: ColumnInput,
) {
  const city = await resolveCity(tripId, cityRef);
  const title = input.title?.trim();
  if (!title) throw badRequest('A column needs a title.');

  const existing = await db
    .select({ key: columns.key, position: columns.position })
    .from(columns)
    .where(eq(columns.cityId, city.id));

  const key = uniqueSlug(
    slugify(input.key || input.id || title, 'column'),
    existing.map((c) => c.key),
  );
  const position = existing.reduce((n, c) => Math.max(n, c.position + 1), 0);
  const columnId = newColumnId();

  await db.transaction(async (tx) => {
    await tx.insert(columns).values({
      id: columnId,
      cityId: city.id,
      key,
      title,
      timed: input.timed ?? true,
      date: input.date ?? null,
      position,
    });
    if (input.items?.length) {
      await insertItems(tx, columnId, input.items);
    }
  });

  await touchTrip(tripId);
  return columnId;
}

export async function updateColumn(
  tripId: string,
  columnRef: string,
  patch: {
    title?: string;
    timed?: boolean;
    date?: string | null;
    position?: number;
  },
) {
  const { column } = await resolveColumn(tripId, columnRef);
  const set: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const clean = patch.title.trim();
    if (!clean) throw badRequest('A column needs a title.');
    set.title = clean;
  }
  if (patch.timed !== undefined) set.timed = patch.timed;
  if (patch.date !== undefined) set.date = patch.date;
  if (patch.position !== undefined) set.position = patch.position;

  if (Object.keys(set).length) {
    await db.update(columns).set(set).where(eq(columns.id, column.id));
    await touchTrip(tripId);
  }
  return column.id;
}

export async function deleteColumn(tripId: string, columnRef: string) {
  const { column } = await resolveColumn(tripId, columnRef);

  if (column.key === BACKLOG_KEY) {
    throw conflict(
      'The Backlog column is reserved and cannot be deleted. Rename it instead.',
    );
  }

  await db.delete(columns).where(eq(columns.id, column.id));
  await touchTrip(tripId);
}

/* ------------------------------------------------------------------ *
 * Items
 * ------------------------------------------------------------------ */

export type ItemInput = {
  title?: string;
  time?: string | null;
  dayOffset?: number;
  durationMin?: number | null;
  blurb?: string;
  tags?: string[];
};

const cleanTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const clean = String(tag).trim().toLowerCase();
    if (clean) seen.add(clean);
  }
  return [...seen];
};

async function nextPosition(
  tx: typeof db,
  columnId: string,
): Promise<number> {
  const [row] = await tx
    .select({ highest: max(items.position) })
    .from(items)
    .where(eq(items.columnId, columnId));
  return (row?.highest ?? -1) + 1;
}

export async function createItem(
  tripId: string,
  columnRef: string,
  input: ItemInput,
) {
  const { column } = await resolveColumn(tripId, columnRef);
  const id = newItemId();

  await db.insert(items).values({
    id,
    columnId: column.id,
    title: input.title?.trim() ?? '',
    time: normaliseTime(input.time),
    dayOffset: input.dayOffset ?? 0,
    durationMin: input.durationMin ?? null,
    blurb: input.blurb ?? '',
    tags: cleanTags(input.tags),
    position: await nextPosition(db, column.id),
  });

  await touchTrip(tripId);
  return id;
}

export async function updateItem(
  tripId: string,
  itemId: string,
  patch: ItemInput & { columnId?: string; position?: number },
) {
  const { item } = await resolveItem(tripId, itemId);
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (patch.title !== undefined) set.title = patch.title;
  if (patch.blurb !== undefined) set.blurb = patch.blurb;
  if (patch.tags !== undefined) set.tags = cleanTags(patch.tags);
  if (patch.durationMin !== undefined) set.durationMin = patch.durationMin;
  if (patch.dayOffset !== undefined) set.dayOffset = patch.dayOffset;

  if (patch.time !== undefined) {
    const time = normaliseTime(patch.time);
    set.time = time;
    // Clearing a time unschedules the card; it can't keep a day offset.
    if (time === null && patch.dayOffset === undefined) set.dayOffset = 0;
  }

  if (patch.columnId !== undefined) {
    const { column } = await resolveColumn(tripId, patch.columnId);
    set.columnId = column.id;
    // A card can't stay on a clock it no longer has.
    if (!column.timed) {
      set.time = null;
      set.dayOffset = 0;
    }
    if (patch.position === undefined) {
      set.position = await nextPosition(db, column.id);
    }
  }

  if (patch.position !== undefined) set.position = patch.position;

  await db.update(items).set(set).where(eq(items.id, item.id));
  await touchTrip(tripId);
  return item.id;
}

export async function deleteItem(tripId: string, itemId: string) {
  const { item } = await resolveItem(tripId, itemId);
  await db.delete(items).where(eq(items.id, item.id));
  await touchTrip(tripId);
}

/**
 * Applies a drag result: destination column, new time (or null to unschedule),
 * and the ordering of the destination list. Ordering is sent as an explicit id
 * list so the server never has to guess what the user saw.
 */
export async function moveItem(
  tripId: string,
  itemId: string,
  move: {
    columnId: string;
    time?: string | null;
    dayOffset?: number;
    order?: string[];
  },
) {
  const { item } = await resolveItem(tripId, itemId);
  const { column } = await resolveColumn(tripId, move.columnId);

  const time = column.timed ? normaliseTime(move.time) : null;
  const dayOffset = time === null ? 0 : (move.dayOffset ?? 0);

  await db.transaction(async (tx) => {
    await tx
      .update(items)
      .set({
        columnId: column.id,
        time,
        dayOffset,
        updatedAt: new Date(),
      })
      .where(eq(items.id, item.id));

    if (move.order?.length) {
      // Renumbering the whole destination list is cheap at this scale and
      // avoids fractional-index drift.
      await Promise.all(
        move.order.map((id, index) =>
          tx
            .update(items)
            .set({ position: index })
            .where(and(eq(items.id, id), eq(items.columnId, column.id))),
        ),
      );
    }
  });

  await touchTrip(tripId);
  return item.id;
}

/** Explicit reordering of a list column, independent of any move. */
export async function reorderColumn(
  tripId: string,
  columnRef: string,
  order: string[],
) {
  const { column } = await resolveColumn(tripId, columnRef);
  await db.transaction(async (tx) => {
    await Promise.all(
      order.map((id, index) =>
        tx
          .update(items)
          .set({ position: index })
          .where(and(eq(items.id, id), eq(items.columnId, column.id))),
      ),
    );
  });
  await touchTrip(tripId);
}

/* ------------------------------------------------------------------ *
 * Bulk import — the primary way a trip gets populated (build spec §4)
 * ------------------------------------------------------------------ */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

async function insertItems(tx: Tx, columnId: string, list: ItemInput[]) {
  if (!list.length) return;
  await tx.insert(items).values(
    list.map((item, index) => ({
      id: newItemId(),
      columnId,
      title: item.title?.trim() ?? '',
      time: normaliseTime(item.time),
      dayOffset: item.dayOffset ?? 0,
      durationMin: item.durationMin ?? null,
      blurb: item.blurb ?? '',
      tags: cleanTags(item.tags),
      position: index,
    })),
  );
}

async function insertColumnTree(
  tx: Tx,
  cityId: string,
  list: ColumnInput[],
) {
  const usedKeys: string[] = [];

  for (const [index, input] of list.entries()) {
    const title = input.title?.trim();
    if (!title) throw badRequest('Every column needs a title.');

    const key = uniqueSlug(
      slugify(input.key || input.id || title, 'column'),
      usedKeys,
    );
    usedKeys.push(key);

    const columnId = newColumnId();
    await tx.insert(columns).values({
      id: columnId,
      cityId,
      key,
      title,
      timed: input.timed ?? true,
      date: input.date ?? null,
      position: index,
    });

    await insertItems(tx, columnId, input.items ?? []);
  }

  // Every city keeps a Backlog, even if the payload didn't mention one.
  if (!usedKeys.includes(BACKLOG_KEY)) {
    await tx.insert(columns).values({
      id: newColumnId(),
      cityId,
      key: BACKLOG_KEY,
      title: 'Backlog',
      timed: false,
      position: list.length,
    });
  }
}

/**
 * Creates a whole city — days, lists and every activity — in one call. This is
 * the endpoint that matters most in practice: the normal case is "here's a day
 * plan I already wrote, create it", not adding one activity at a time.
 */
export async function importCity(tripId: string, input: CityInput) {
  return createCity(tripId, input);
}

export async function importBoard(
  tripId: string,
  input: { cities: CityInput[]; replace?: boolean },
) {
  if (!Array.isArray(input.cities) || input.cities.length === 0) {
    throw badRequest('Provide at least one city to import.');
  }

  if (input.replace) {
    await db.delete(cities).where(eq(cities.tripId, tripId));
  }

  const created: string[] = [];
  for (const city of input.cities) {
    created.push(await createCity(tripId, city));
  }
  return created;
}
