'use client';

import { useEffect, useState } from 'react';

import type { BoardDTO } from '@/server/board';

import { BoardCanvas } from './board-canvas';
import { BoardHeader } from './board-header';
import { CityTabs } from './city-tabs';
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
        <CityTabs />
        <ActiveCityBoard />
      </div>
    </BoardStoreProvider>
  );
}

function ActiveCityBoard() {
  const trip = useTrip();
  return <BoardCanvas cityId={trip.activeCityId} />;
}
