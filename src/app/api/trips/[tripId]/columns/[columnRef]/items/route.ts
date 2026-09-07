import { body, tripRoute } from '@/lib/api/handler';
import { itemInput } from '@/lib/api/schemas';
import { createItem } from '@/server/board';

type P = { tripId: string; columnRef: string };

export const POST = tripRoute<P>(async ({ req, tripId, params }) => {
  const input = await body(req, itemInput);
  return createItem(tripId, params.columnRef, input);
});
