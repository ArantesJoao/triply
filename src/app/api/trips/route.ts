import { authed, body } from '@/lib/api/handler';
import { createTripBody } from '@/lib/api/schemas';
import { createTrip, listTripsForUser } from '@/server/trips';

export const GET = authed(async ({ actor }) => ({
  trips: await listTripsForUser(actor.userId),
}));

export const POST = authed(async ({ req, actor }) => {
  const input = await body(req, createTripBody);
  const id = await createTrip(actor.userId, input.title);
  return { id };
});
