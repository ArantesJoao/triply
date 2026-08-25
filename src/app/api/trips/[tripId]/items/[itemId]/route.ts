import { body, tripRoute } from '@/lib/api/handler';
import { updateItemBody } from '@/lib/api/schemas';
import { deleteItem, updateItem } from '@/server/board';

type P = { tripId: string; itemId: string };

export const PATCH = tripRoute<P>(async ({ req, tripId, params }) => {
  const id = await updateItem(tripId, params.itemId, await body(req, updateItemBody));
  return { id };
});

export const DELETE = tripRoute<P>(async ({ tripId, params }) => {
  await deleteItem(tripId, params.itemId);
  return { ok: true };
});
