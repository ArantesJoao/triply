import { authed } from '@/lib/api/handler';
import { revokeConnection } from '@/server/oauth';

/**
 * Disconnects an app from Settings. Deleting the grant kills its access and
 * refresh tokens together, so the app is locked out on its very next call.
 */
export const DELETE = authed<{ grantId: string }>(async ({ actor, params }) => {
  await revokeConnection(actor.userId, params.grantId);
  return { ok: true };
});
