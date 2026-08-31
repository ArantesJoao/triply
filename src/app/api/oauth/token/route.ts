import {
  authenticateClient,
  corsHeaders,
  oauthErrorResponse,
  OAuthError,
  redeemCode,
  refreshGrant,
} from '@/server/oauth';

/**
 * The token endpoint: an authorization code or a refresh token in, an access
 * token out. Form-encoded both ways, per RFC 6749.
 *
 * Responses carry `Cache-Control: no-store` because they contain credentials
 * and RFC 6749 section 5.1 says so.
 */

/**
 * Client credentials arrive either in the body (`client_secret_post`) or in an
 * `Authorization: Basic` header (`client_secret_basic`). Both are advertised in
 * the metadata, so both have to be read here. Basic wins where a client sends
 * both, which is the reading RFC 6749 section 2.3.1 prefers.
 */
function credentials(req: Request, form: URLSearchParams) {
  const header = req.headers.get('authorization');

  if (header?.toLowerCase().startsWith('basic ')) {
    const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString();
    const separator = decoded.indexOf(':');
    if (separator !== -1) {
      return {
        clientId: decodeURIComponent(decoded.slice(0, separator)),
        clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
      };
    }
  }

  return {
    clientId: form.get('client_id') ?? undefined,
    clientSecret: form.get('client_secret') ?? undefined,
  };
}

export async function POST(req: Request) {
  try {
    const form = new URLSearchParams(await req.text());
    const { clientId, clientSecret } = credentials(req, form);
    const client = await authenticateClient(clientId, clientSecret);

    const grantType = form.get('grant_type');
    let tokens;

    if (grantType === 'authorization_code') {
      const code = form.get('code');
      if (!code) throw new OAuthError('invalid_request', 'code is required.');

      tokens = await redeemCode({
        code,
        clientId: client.id,
        redirectUri: form.get('redirect_uri') ?? undefined,
        codeVerifier: form.get('code_verifier') ?? undefined,
      });
    } else if (grantType === 'refresh_token') {
      const refreshToken = form.get('refresh_token');
      if (!refreshToken) {
        throw new OAuthError('invalid_request', 'refresh_token is required.');
      }

      tokens = await refreshGrant({ refreshToken, clientId: client.id });
    } else {
      throw new OAuthError(
        'unsupported_grant_type',
        'Supported grant types are authorization_code and refresh_token.',
      );
    }

    return Response.json(tokens, {
      headers: { ...corsHeaders(), 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
