import { corsHeaders, revokeByToken } from '@/server/oauth';

/**
 * RFC 7009 revocation, so a client can hand the grant back when someone
 * disconnects trip.ly from its own settings instead of ours.
 *
 * Unauthenticated on purpose: holding the token is the proof. The RFC also
 * requires 200 for an unknown token, which stops this being a way to probe
 * whether a guessed token exists.
 */
export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text().catch(() => ''));
  const token = form.get('token');

  if (token) await revokeByToken(token);

  return new Response(null, { status: 200, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
