import { tripRoute } from '@/lib/api/handler';
import { geocodeColumn } from '@/server/geocode';

type P = { tripId: string; columnRef: string };

export const GET = tripRoute<P>(async ({ tripId, params }) => {
  return geocodeColumn(tripId, params.columnRef);
});
