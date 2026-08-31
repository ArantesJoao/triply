import { corsHeaders, originFor, SCOPE } from '@/server/oauth';

/**
 * RFC 8414 authorization server metadata. Everything a client needs to run the
 * flow without a human copying anything: where to register, where to send the
 * person, where to exchange the code.
 *
 * `issuer` must equal the origin this document was fetched from, so it comes
 * from the request rather than a constant — see `originFor`.
 *
 * Only S256 is listed under PKCE. OAuth 2.1 drops `plain`, and advertising it
 * would invite a client to use it.
 */
export async function GET(req: Request) {
  const origin = originFor(req);

  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      revocation_endpoint: `${origin}/api/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: [
        'none',
        'client_secret_post',
        'client_secret_basic',
      ],
      revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      scopes_supported: [SCOPE],
      service_documentation: `${origin}/docs`,
    },
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
