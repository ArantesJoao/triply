import { sessionActor } from '@/server/access';
import {
  getClient,
  issueCode,
  matchesRegisteredUri,
  originFor,
} from '@/server/oauth';

/**
 * Where the consent screen posts. Turns Allow into an authorization code and
 * sends the browser back to the client; turns Cancel into `access_denied`.
 *
 * A plain form post, answered with a real 303, because the destination is
 * often a loopback listener or a private-use scheme that only the browser can
 * reach — a Next server action would try to navigate the router there instead.
 *
 * Every field in the form is re-validated here rather than trusted. The page
 * that rendered them proved nothing: the hidden inputs are as editable as any
 * query string, so the client and the redirect URI have to be checked again
 * before a code exists.
 *
 * There is no CSRF token because the session cookie is SameSite=Lax. A
 * cross-site POST arrives without it and falls out at the signed-out branch.
 */
/**
 * RFC 8707: a code may only name a resource this server actually serves. The
 * authorize page checks this too, but its verdict arrives here as an editable
 * hidden field, so the check has to happen where the code is minted.
 */
function servedHere(resource: string | null, origin: string) {
  if (!resource) return true;
  try {
    return new URL(resource).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text());

  const clientId = form.get('client_id') ?? '';
  const redirectUri = form.get('redirect_uri') ?? '';
  const codeChallenge = form.get('code_challenge') ?? '';
  const state = form.get('state');
  const resource = form.get('resource');

  const client = await getClient(clientId);
  if (
    !client ||
    !codeChallenge ||
    !client.redirectUris.some((uri) => matchesRegisteredUri(uri, redirectUri)) ||
    !servedHere(resource, originFor(req))
  ) {
    return new Response('Invalid authorization request.', { status: 400 });
  }

  const actor = await sessionActor();
  if (!actor) {
    return new Response('Sign in to trip.ly and try connecting again.', {
      status: 401,
    });
  }

  const url = new URL(redirectUri);

  if (form.get('decision') === 'allow') {
    url.searchParams.set(
      'code',
      await issueCode({
        clientId: client.id,
        userId: actor.userId,
        redirectUri,
        codeChallenge,
        resource,
      }),
    );
  } else {
    url.searchParams.set('error', 'access_denied');
    url.searchParams.set('error_description', 'You cancelled the connection.');
  }

  if (state !== null) url.searchParams.set('state', state);

  // 303 so the browser follows with GET rather than replaying the POST.
  return Response.redirect(url.toString(), 303);
}
