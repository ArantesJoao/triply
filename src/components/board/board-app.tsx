'use client';

import { useCallback, useEffect, useState } from 'react';

import type { BoardDTO } from '@/lib/board-model';

import { BoardCanvas } from './board-canvas';
import { BoardHeader } from './board-header';
import { CueStrip } from './cue-strip';
import { prefetchDayMaps } from './day-map-cache';
import {
  BoardStore,
  BoardStoreProvider,
  normalise,
  useTrip,
} from './store';

/**
 * Client root for a trip. The store is created once from the server-rendered
 * board and then owns all subsequent state, so navigating or editing never
 * re-mounts the board and loses scroll position.
 */
export function BoardApp({
  board,
  user,
}: {
  board: BoardDTO & { isOwner: boolean };
  user: { name: string; image: string | null };
}) {
  const [store] = useState(() => new BoardStore(normalise(board)));

  // Pick up other people's edits. Polling a revision counter is plenty for a
  // group this size, and it never fires mid-save.
  useEffect(() => store.startPolling(), [store]);

  // Warm every day's map in the background as soon as the board opens, so
  // the Map button on a day column reads its data off an already-resolved
  // cache instead of showing "Placing today's stops…" the first time it's
  // clicked. The active city's days go first, since that's the one the
  // person is actually looking at.
  useEffect(() => {
    const cityIds = [
      ...(board.activeCityId ? [board.activeCityId] : []),
      ...board.cities.map((city) => city.id).filter((id) => id !== board.activeCityId),
    ];
    const columnIds = cityIds.flatMap((cityId) =>
      (board.cities.find((city) => city.id === cityId)?.columns ?? [])
        .filter((column) => column.timed && column.items.length > 0)
        .map((column) => column.id),
    );
    prefetchDayMaps(board.id, columnIds);
    // Only the board this component was mounted for — not `board` itself,
    // which would re-run this on every store update rather than once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id]);

  return (
    <BoardStoreProvider value={store}>
      <div className="flex h-dvh flex-col overflow-hidden bg-page">
        <BoardHeader user={user} />
        <ActiveCityBoard />
      </div>
    </BoardStoreProvider>
  );
}

function ActiveCityBoard() {
  const trip = useTrip();

  // Tag filter state lives here so the cue strip and the board canvas share it.
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = useCallback((tag: string) => {
    setActiveFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  // Reset filters when switching cities.
  useEffect(() => {
    setActiveFilters([]);
  }, [trip.activeCityId]);

  // Quick-add: create a blank card in the first timed column of this city.
  const [addRequest, setAddRequest] = useState(0);

  return (
    <>
      {/* Cue strip replaces the old CityTabs bar — city switching, tag
          filtering, quick-add, and timeline marker in one compact strip. */}
      <CueStrip
        onAddItem={() => setAddRequest((n) => n + 1)}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
      />
      <BoardCanvas
        cityId={trip.activeCityId}
        tagFilters={activeFilters}
        addRequest={addRequest}
      />
    </>
  );
}
