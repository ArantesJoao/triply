import { authed, body } from '@/lib/api/handler';
import { createTokenBody } from '@/lib/api/schemas';
import { createToken, listTokens } from '@/server/tokens';

export const GET = authed(async ({ actor }) => ({
  tokens: await listTokens(actor.userId),
}));

/** The plaintext token in this response is the only time it is ever shown. */
export const POST = authed(async ({ req, actor }) => {
  const { name } = await body(req, createTokenBody);
  return createToken(actor.userId, name);
});
