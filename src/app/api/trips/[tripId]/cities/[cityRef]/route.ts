import { body, tripRoute } from '@/lib/api/handler';
import { updateCityBody } from '@/lib/api/schemas';
import { deleteCity, getCity, updateCity } from '@/server/board';

type P = { tripId: string; cityRef: string };

export const GET = tripRoute<P>(({ tripId, params }) =>
  getCity(tripId, params.cityRef),
);

export const PATCH = tripRoute<P>(async ({ req, tripId, params }) => {
  const id = await updateCity(tripId, params.cityRef, await body(req, updateCityBody));
  return { id };
});

export const DELETE = tripRoute<P>(async ({ tripId, params }) => {
  await deleteCity(tripId, params.cityRef);
  return { ok: true };
});
