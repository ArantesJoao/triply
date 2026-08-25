import { body, tripRoute } from '@/lib/api/handler';
import { inviteBody } from '@/lib/api/schemas';
import { inviteToTrip, listTripPeople, removeMember, revokeInvite } from '@/server/invites';

type P = { tripId: string };

export const GET = tripRoute<P>(({ tripId }) => listTripPeople(tripId));

export const POST = tripRoute<P>(
  async ({ req, tripId, actor }) => {
    const { email } = await body(req, inviteBody);
    return inviteToTrip(tripId, email, actor.userId);
  },
  { owner: true },
);

/** ?userId=… removes a member; ?email=… withdraws a pending invitation. */
export const DELETE = tripRoute<P>(
  async ({ req, tripId }) => {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const email = url.searchParams.get('email');

    if (userId) await removeMember(tripId, userId);
    else if (email) await revokeInvite(tripId, email);

    return { ok: true };
  },
  { owner: true },
);
