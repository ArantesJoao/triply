import { tripRoute } from '@/lib/api/handler';
import { rotateShareToken } from '@/server/trips';

/** Invalidates the old /join link and issues a new one. */
export const POST = tripRoute<{ tripId: string }>(
  async ({ tripId }) => ({ shareToken: await rotateShareToken(tripId) }),
  { owner: true },
);
