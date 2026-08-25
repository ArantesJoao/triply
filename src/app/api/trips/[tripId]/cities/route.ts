import { body, tripRoute } from '@/lib/api/handler';
import { cityInput } from '@/lib/api/schemas';
import { createCity, getBoard } from '@/server/board';

type P = { tripId: string };

export const GET = tripRoute<P>(async ({ tripId }) => ({
  cities: (await getBoard(tripId)).cities,
}));

/** Accepts a bare title, or a whole nested city (columns + items) at once. */
export const POST = tripRoute<P>(async ({ req, tripId }) => {
  const input = await body(req, cityInput);
  const id = await createCity(tripId, input);
  return { id };
});
