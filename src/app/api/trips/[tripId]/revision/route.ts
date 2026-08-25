import { tripRoute } from '@/lib/api/handler';
import { getTripRevision } from '@/server/trips';

/** Polled by open boards to notice edits made by other people. */
export const GET = tripRoute<{ tripId: string }>(({ tripId }) =>
  getTripRevision(tripId),
);
