import { body, tripRoute } from '@/lib/api/handler';
import { columnInput } from '@/lib/api/schemas';
import { createColumn } from '@/server/board';

type P = { tripId: string; cityRef: string };

export const POST = tripRoute<P>(async ({ req, tripId, params }) => {
  const input = await body(req, columnInput);
  const id = await createColumn(tripId, params.cityRef, input);
  return { id };
});
