import { body, tripRoute } from '@/lib/api/handler';
import { importBoardBody } from '@/lib/api/schemas';
import { getBoard, importBoard } from '@/server/board';

/**
 * Bulk create: a whole board's worth of cities, columns and items in one call.
 * This is the endpoint the "paste a trip plan at Claude" workflow uses.
 */
export const POST = tripRoute<{ tripId: string }>(async ({ req, tripId }) => {
  const input = await body(req, importBoardBody);
  const created = await importBoard(tripId, input);
  return { created, board: await getBoard(tripId) };
});
