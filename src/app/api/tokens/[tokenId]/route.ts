import { authed } from '@/lib/api/handler';
import { deleteToken } from '@/server/tokens';

export const DELETE = authed<{ tokenId: string }>(async ({ actor, params }) => {
  await deleteToken(actor.userId, params.tokenId);
  return { ok: true };
});
