import { body, tripRoute } from '@/lib/api/handler';
import { updateTripBody } from '@/lib/api/schemas';
import { getBoard } from '@/server/board';
import { deleteTrip, updateTrip } from '@/server/trips';

type P = { tripId: string };

export const GET = tripRoute<P>(async ({ tripId, access }) => ({
  ...(await getBoard(tripId)),
  role: access.role,
  isOwner: access.isOwner,
}));

export const PATCH = tripRoute<P>(async ({ req, tripId }) => {
  await updateTrip(tripId, await body(req, updateTripBody));
  return { ok: true };
});

export const DELETE = tripRoute<P>(
  async ({ tripId }) => {
    await deleteTrip(tripId);
    return { ok: true };
  },
  { owner: true },
);
