import { body, tripRoute } from '@/lib/api/handler';
import { updateColumnBody } from '@/lib/api/schemas';
import { deleteColumn, updateColumn } from '@/server/board';

type P = { tripId: string; columnRef: string };

export const PATCH = tripRoute<P>(async ({ req, tripId, params }) => {
  const id = await updateColumn(
    tripId,
    params.columnRef,
    await body(req, updateColumnBody),
  );
  return { id };
});

/** Rejects the reserved `backlog` column with a 409. */
export const DELETE = tripRoute<P>(async ({ tripId, params }) => {
  await deleteColumn(tripId, params.columnRef);
  return { ok: true };
});
