'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
} from 'react';

import type { BoardDTO, ItemDTO } from '@/server/board';

/* ------------------------------------------------------------------ *
 * Normalised state.
 *
 * The prototype re-rendered the whole board on every blur, tag change and
 * drop, which cost scroll position and felt janky. Here the board is stored as
 * flat records and components subscribe to a single record, so editing one
 * card's title re-renders that card and nothing else.
 * ------------------------------------------------------------------ */

export type ItemRecord = ItemDTO & { columnId: string };

export type ColumnRecord = {
  id: string;
  key: string;
  title: string;
  timed: boolean;
  date: string | null;
  cityId: string;
  itemIds: string[];
};

export type CityRecord = {
  id: string;
  key: string;
  title: string;
  columnIds: string[];
};

export type TripRecord = {
  id: string;
  title: string;
  activeCityId: string | null;
  shareToken: string;
  revision: number;
  isOwner: boolean;
};

export type BoardState = {
  trip: TripRecord;
  cityIds: string[];
  cities: Record<string, CityRecord>;
  columns: Record<string, ColumnRecord>;
  items: Record<string, ItemRecord>;
};

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string; retry: () => void };

export function normalise(
  board: BoardDTO & { isOwner?: boolean },
): BoardState {
  const cities: Record<string, CityRecord> = {};
  const columns: Record<string, ColumnRecord> = {};
  const items: Record<string, ItemRecord> = {};

  for (const city of board.cities) {
    cities[city.id] = {
      id: city.id,
      key: city.key,
      title: city.title,
      columnIds: city.columns.map((column) => column.id),
    };

    for (const column of city.columns) {
      columns[column.id] = {
        id: column.id,
        key: column.key,
        title: column.title,
        timed: column.timed,
        date: column.date,
        cityId: city.id,
        itemIds: column.items.map((item) => item.id),
      };

      for (const item of column.items) {
        items[item.id] = { ...item, columnId: column.id };
      }
    }
  }

  return {
    trip: {
      id: board.id,
      title: board.title,
      activeCityId: board.activeCityId ?? board.cities[0]?.id ?? null,
      shareToken: board.shareToken,
      revision: board.revision,
      isOwner: board.isOwner ?? false,
    },
    cityIds: board.cities.map((city) => city.id),
    cities,
    columns,
    items,
  };
}

/* ------------------------------------------------------------------ */

type Listener = () => void;

export class BoardStore {
  private state: BoardState;
  private listeners = new Set<Listener>();

  private status: SaveStatus = { kind: 'idle' };
  private statusListeners = new Set<Listener>();

  /** Outstanding mutations — polling stands down while this is non-zero. */
  private inFlight = 0;

  constructor(initial: BoardState) {
    this.state = initial;
  }

  /* --- subscriptions ------------------------------------------------ */

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  subscribeStatus = (listener: Listener) => {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  };

  getStatus = () => this.status;

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private setStatus(status: SaveStatus) {
    this.status = status;
    for (const listener of this.statusListeners) listener();
  }

  /**
   * Applies a local change immediately, then persists it. On failure the
   * previous state is restored and the error is surfaced locally — the board
   * is never replaced wholesale because one mutation failed.
   */
  private async commit(
    apply: (state: BoardState) => BoardState,
    persist: () => Promise<unknown>,
    description: string,
  ) {
    const previous = this.state;
    this.state = apply(previous);
    this.emit();

    this.inFlight += 1;
    this.setStatus({ kind: 'saving' });

    try {
      await persist();
      this.setStatus({ kind: 'saved', at: Date.now() });
    } catch (error) {
      this.state = previous;
      this.emit();
      this.setStatus({
        kind: 'error',
        message:
          error instanceof Error ? error.message : `Couldn't ${description}.`,
        retry: () => void this.commit(apply, persist, description),
      });
    } finally {
      this.inFlight -= 1;
    }
  }

  get isBusy() {
    return this.inFlight > 0;
  }

  dismissError() {
    if (this.status.kind === 'error') this.setStatus({ kind: 'idle' });
  }

  /**
   * Replaces state with a fresh server snapshot after someone else's edit.
   * Records that are unchanged keep their identity, so an incoming update to
   * one card doesn't re-render the rest of the board.
   */
  reconcile(next: BoardState) {
    this.state = {
      trip: shallowKeep(this.state.trip, next.trip),
      cityIds: arrayKeep(this.state.cityIds, next.cityIds),
      cities: mapKeep(this.state.cities, next.cities),
      columns: mapKeep(this.state.columns, next.columns),
      items: mapKeep(this.state.items, next.items),
    };
    this.emit();
  }

  /* --- mutations ---------------------------------------------------- */

  private get base() {
    return `/api/trips/${this.state.trip.id}`;
  }

  setActiveCity(cityId: string) {
    void this.commit(
      (state) => ({ ...state, trip: { ...state.trip, activeCityId: cityId } }),
      () =>
        request(`${this.base}`, {
          method: 'PATCH',
          body: JSON.stringify({ activeCityId: cityId }),
        }),
      'switch city',
    );
  }

  renameTrip(title: string) {
    void this.commit(
      (state) => ({ ...state, trip: { ...state.trip, title } }),
      () =>
        request(this.base, {
          method: 'PATCH',
          body: JSON.stringify({ title }),
        }),
      'rename the trip',
    );
  }

  renameCity(cityId: string, title: string) {
    void this.commit(
      (state) => ({
        ...state,
        cities: { ...state.cities, [cityId]: { ...state.cities[cityId], title } },
      }),
      () =>
        request(`${this.base}/cities/${cityId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title }),
        }),
      'rename the city',
    );
  }

  async addCity(title: string): Promise<string | null> {
    try {
      this.setStatus({ kind: 'saving' });
      const { id } = await request<{ id: string }>(`${this.base}/cities`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      await this.refetch();
      this.state = {
        ...this.state,
        trip: { ...this.state.trip, activeCityId: id },
      };
      this.emit();
      this.setStatus({ kind: 'saved', at: Date.now() });
      return id;
    } catch (error) {
      this.setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not add city.',
        retry: () => void this.addCity(title),
      });
      return null;
    }
  }

  deleteCity(cityId: string) {
    void this.commit(
      (state) => {
        const cities = { ...state.cities };
        const columns = { ...state.columns };
        const items = { ...state.items };

        for (const columnId of cities[cityId]?.columnIds ?? []) {
          for (const itemId of columns[columnId]?.itemIds ?? [])
            delete items[itemId];
          delete columns[columnId];
        }
        delete cities[cityId];

        const cityIds = state.cityIds.filter((id) => id !== cityId);
        return {
          ...state,
          cities,
          columns,
          items,
          cityIds,
          trip: {
            ...state.trip,
            activeCityId:
              state.trip.activeCityId === cityId
                ? (cityIds[0] ?? null)
                : state.trip.activeCityId,
          },
        };
      },
      () => request(`${this.base}/cities/${cityId}`, { method: 'DELETE' }),
      'delete the city',
    );
  }

  async addColumn(cityId: string, title: string, timed: boolean) {
    try {
      this.setStatus({ kind: 'saving' });
      const { id } = await request<{ id: string }>(
        `${this.base}/cities/${cityId}/columns`,
        { method: 'POST', body: JSON.stringify({ title, timed }) },
      );
      await this.refetch();
      this.setStatus({ kind: 'saved', at: Date.now() });
      return id;
    } catch (error) {
      this.setStatus({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Could not add the column.',
        retry: () => void this.addColumn(cityId, title, timed),
      });
      return null;
    }
  }

  renameColumn(columnId: string, title: string) {
    void this.commit(
      (state) => ({
        ...state,
        columns: {
          ...state.columns,
          [columnId]: { ...state.columns[columnId], title },
        },
      }),
      () =>
        request(`${this.base}/columns/${columnId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title }),
        }),
      'rename the column',
    );
  }

  deleteColumn(columnId: string) {
    void this.commit(
      (state) => {
        const column = state.columns[columnId];
        if (!column) return state;

        const columns = { ...state.columns };
        const items = { ...state.items };
        for (const itemId of column.itemIds) delete items[itemId];
        delete columns[columnId];

        return {
          ...state,
          columns,
          items,
          cities: {
            ...state.cities,
            [column.cityId]: {
              ...state.cities[column.cityId],
              columnIds: state.cities[column.cityId].columnIds.filter(
                (id) => id !== columnId,
              ),
            },
          },
        };
      },
      () => request(`${this.base}/columns/${columnId}`, { method: 'DELETE' }),
      'delete the column',
    );
  }

  /** Creates a blank card; the caller focuses its title for immediate editing. */
  async addItem(columnId: string, seed: Partial<ItemDTO> = {}) {
    const temporaryId = `temp_${Math.random().toString(36).slice(2, 10)}`;
    const optimistic: ItemRecord = {
      id: temporaryId,
      columnId,
      title: '',
      time: null,
      dayOffset: 0,
      durationMin: null,
      blurb: '',
      tags: [],
      position: this.state.columns[columnId]?.itemIds.length ?? 0,
      ...seed,
    };

    this.state = {
      ...this.state,
      items: { ...this.state.items, [temporaryId]: optimistic },
      columns: {
        ...this.state.columns,
        [columnId]: {
          ...this.state.columns[columnId],
          itemIds: [...this.state.columns[columnId].itemIds, temporaryId],
        },
      },
    };
    this.emit();
    this.setStatus({ kind: 'saving' });

    try {
      const { id } = await request<{ id: string }>(
        `${this.base}/columns/${columnId}/items`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: optimistic.title,
            time: optimistic.time,
            dayOffset: optimistic.dayOffset,
            durationMin: optimistic.durationMin,
            blurb: optimistic.blurb,
            tags: optimistic.tags,
          }),
        },
      );

      // Swap the placeholder id for the real one, in place.
      const items = { ...this.state.items };
      const record = { ...items[temporaryId], id };
      delete items[temporaryId];
      items[id] = record;

      this.state = {
        ...this.state,
        items,
        columns: {
          ...this.state.columns,
          [columnId]: {
            ...this.state.columns[columnId],
            itemIds: this.state.columns[columnId].itemIds.map((itemId) =>
              itemId === temporaryId ? id : itemId,
            ),
          },
        },
      };
      this.emit();
      this.setStatus({ kind: 'saved', at: Date.now() });
      return id;
    } catch (error) {
      const items = { ...this.state.items };
      delete items[temporaryId];
      this.state = {
        ...this.state,
        items,
        columns: {
          ...this.state.columns,
          [columnId]: {
            ...this.state.columns[columnId],
            itemIds: this.state.columns[columnId].itemIds.filter(
              (itemId) => itemId !== temporaryId,
            ),
          },
        },
      };
      this.emit();
      this.setStatus({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Could not add the card.',
        retry: () => void this.addItem(columnId, seed),
      });
      return null;
    }
  }

  patchItem(itemId: string, patch: Partial<ItemDTO>) {
    const current = this.state.items[itemId];
    if (!current) return;
    // Skip no-op saves — inline editors commit on blur whether or not the
    // value actually changed.
    const changed = Object.entries(patch).some(([key, value]) => {
      const existing = current[key as keyof ItemDTO];
      return Array.isArray(value)
        ? JSON.stringify(existing) !== JSON.stringify(value)
        : existing !== value;
    });
    if (!changed) return;

    void this.commit(
      (state) => ({
        ...state,
        items: { ...state.items, [itemId]: { ...state.items[itemId], ...patch } },
      }),
      () =>
        request(`${this.base}/items/${itemId}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }),
      'save the card',
    );
  }

  deleteItem(itemId: string) {
    void this.commit(
      (state) => {
        const item = state.items[itemId];
        if (!item) return state;
        const items = { ...state.items };
        delete items[itemId];
        return {
          ...state,
          items,
          columns: {
            ...state.columns,
            [item.columnId]: {
              ...state.columns[item.columnId],
              itemIds: state.columns[item.columnId].itemIds.filter(
                (id) => id !== itemId,
              ),
            },
          },
        };
      },
      () => request(`${this.base}/items/${itemId}`, { method: 'DELETE' }),
      'delete the card',
    );
  }

  /** Applies a drag result: destination column, time, and destination order. */
  moveItem(
    itemId: string,
    to: { columnId: string; time: string | null; dayOffset?: number },
    order?: string[],
  ) {
    const item = this.state.items[itemId];
    if (!item) return;

    const fromColumnId = item.columnId;
    const destination = this.state.columns[to.columnId];
    const time = destination?.timed ? to.time : null;
    const dayOffset = time === null ? 0 : (to.dayOffset ?? item.dayOffset);

    void this.commit(
      (state) => {
        const columns = { ...state.columns };

        columns[fromColumnId] = {
          ...columns[fromColumnId],
          itemIds: columns[fromColumnId].itemIds.filter((id) => id !== itemId),
        };

        // `columns[to.columnId]` already has the card removed when the move is
        // within one column, so appending is right in both cases.
        columns[to.columnId] = {
          ...columns[to.columnId],
          itemIds: order ?? [...columns[to.columnId].itemIds, itemId],
        };

        return {
          ...state,
          columns,
          items: {
            ...state.items,
            [itemId]: {
              ...state.items[itemId],
              columnId: to.columnId,
              time,
              dayOffset,
            },
          },
        };
      },
      () =>
        request(`${this.base}/items/${itemId}/move`, {
          method: 'POST',
          body: JSON.stringify({
            columnId: to.columnId,
            time,
            dayOffset,
            order,
          }),
        }),
      'move the card',
    );
  }

  reorderColumn(columnId: string, order: string[]) {
    void this.commit(
      (state) => ({
        ...state,
        columns: {
          ...state.columns,
          [columnId]: { ...state.columns[columnId], itemIds: order },
        },
      }),
      () =>
        request(`${this.base}/columns/${columnId}/reorder`, {
          method: 'POST',
          body: JSON.stringify({ order }),
        }),
      'reorder the list',
    );
  }

  /* --- syncing ------------------------------------------------------ */

  async refetch() {
    const board = await request<BoardDTO & { isOwner: boolean }>(this.base, {
      method: 'GET',
    });
    this.reconcile(normalise(board));
  }

  /**
   * Polls the trip's revision counter and pulls a fresh board only when it has
   * actually moved — and never mid-save, so an in-flight optimistic edit can't
   * be clobbered by a stale snapshot.
   */
  startPolling(intervalMs = 6000) {
    let stopped = false;

    const tick = async () => {
      if (stopped || this.isBusy || document.hidden) return;
      try {
        const { revision } = await request<{ revision: number }>(
          `${this.base}/revision`,
          { method: 'GET' },
        );
        if (!stopped && !this.isBusy && revision !== this.state.trip.revision) {
          await this.refetch();
        }
      } catch {
        // A dropped poll is not worth surfacing; the next one will catch up.
      }
    };

    const timer = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }
}

/* ------------------------------------------------------------------ *
 * Structural sharing helpers — keep identity for records that did not change
 * so `useSyncExternalStore` selectors don't fire needlessly.
 * ------------------------------------------------------------------ */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function shallowKeep<T>(previous: T, next: T): T {
  return same(previous, next) ? previous : next;
}

function arrayKeep<T>(previous: T[], next: T[]): T[] {
  return same(previous, next) ? previous : next;
}

function mapKeep<T>(
  previous: Record<string, T>,
  next: Record<string, T>,
): Record<string, T> {
  const merged: Record<string, T> = {};
  let identical = Object.keys(previous).length === Object.keys(next).length;

  for (const [key, value] of Object.entries(next)) {
    if (previous[key] && same(previous[key], value)) {
      merged[key] = previous[key];
    } else {
      merged[key] = value;
      identical = false;
    }
  }

  return identical ? previous : merged;
}

/* ------------------------------------------------------------------ *
 * React bindings
 * ------------------------------------------------------------------ */

export async function request<T = unknown>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.message ?? `Request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

const StoreContext = createContext<BoardStore | null>(null);

export const BoardStoreProvider = StoreContext.Provider;

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside a board provider.');
  return store;
}

/**
 * Subscribes to one slice; re-renders only when that slice's identity changes.
 * Selectors must return a stable reference for unchanged data — reach for the
 * purpose-built hooks below rather than building objects inline.
 */
export function useBoard<T>(select: (state: BoardState) => T): T {
  const store = useStore();
  const snapshot = () => select(store.getState());
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

export function useTrip() {
  const store = useStore();
  const snapshot = useCallback(() => store.getState().trip, [store]);
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

export function useCityIds() {
  const store = useStore();
  const snapshot = useCallback(() => store.getState().cityIds, [store]);
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

export function useCity(cityId: string | null): CityRecord | undefined {
  const store = useStore();
  const snapshot = useCallback(
    () => (cityId ? store.getState().cities[cityId] : undefined),
    [store, cityId],
  );
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

export function useColumn(columnId: string): ColumnRecord | undefined {
  const store = useStore();
  const snapshot = useCallback(
    () => store.getState().columns[columnId],
    [store, columnId],
  );
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

export function useItem(itemId: string): ItemRecord | undefined {
  const store = useStore();
  const snapshot = useCallback(
    () => store.getState().items[itemId],
    [store, itemId],
  );
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

const EMPTY_ITEMS: ItemRecord[] = [];

const sameRefs = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * A column's items, in order. The returned array keeps its identity unless one
 * of *this* column's items actually changed, so editing a card in one day
 * doesn't relayout every other day.
 */
export function useColumnItems(columnId: string): ItemRecord[] {
  const store = useStore();
  const cache = useRef<{ deps: unknown[]; value: ItemRecord[] } | null>(null);

  const snapshot = useCallback(() => {
    const state = store.getState();
    const column = state.columns[columnId];
    if (!column) return EMPTY_ITEMS;

    const deps = column.itemIds.map((id) => state.items[id]);
    if (cache.current && sameRefs(cache.current.deps, deps)) {
      return cache.current.value;
    }

    const value = deps.filter(Boolean) as ItemRecord[];
    cache.current = { deps, value };
    return value;
  }, [store, columnId]);

  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}

export function useSaveStatus(): SaveStatus {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribeStatus,
    store.getStatus,
    store.getStatus,
  );
}
