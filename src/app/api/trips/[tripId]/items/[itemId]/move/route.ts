import { body, tripRoute } from '@/lib/api/handler';
import { moveItemBody } from '@/lib/api/schemas';
import { moveItem } from '@/server/board';

type P = { tripId: string; itemId: string };

/** Applies a drag: destination column, resulting time, destination ordering. */
export const POST = tripRoute<P>(async ({ req, tripId, params }) => {
  const move = await body(req, moveItemBody);
  const id = await moveItem(tripId, params.itemId, move);
  return { id };
});
