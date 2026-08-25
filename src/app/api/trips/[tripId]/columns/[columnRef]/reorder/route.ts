import { body, tripRoute } from '@/lib/api/handler';
import { reorderBody } from '@/lib/api/schemas';
import { reorderColumn } from '@/server/board';

type P = { tripId: string; columnRef: string };

export const POST = tripRoute<P>(async ({ req, tripId, params }) => {
  const { order } = await body(req, reorderBody);
  await reorderColumn(tripId, params.columnRef, order);
  return { ok: true };
});
