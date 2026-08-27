'use client';

import { useCallback, useEffect, useState } from 'react';

import type { BoardDTO } from '@/lib/board-model';

import { BoardCanvas } from './board-canvas';
import { BoardHeader } from './board-header';
import { CueStrip } from './cue-strip';
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
