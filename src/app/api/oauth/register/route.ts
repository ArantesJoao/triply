import { z } from 'zod';

import {
  corsHeaders,
  oauthErrorResponse,
  OAuthError,
  registerClient,
  SCOPE,
} from '@/server/oauth';

/**
 * RFC 7591 dynamic client registration.
 *
 * Deliberately unauthenticated — see `registerClient` for why that is safe.
 * Unknown metadata fields are ignored rather than rejected, as the RFC
 * requires: clients send a spread of optional fields and refusing the ones we
 * do not store would fail registrations for no reason.
 */
const registration = z
  .object({
    redirect_uris: z.array(z.string()).min(1),
    client_name: z.string().optional(),
    logo_uri: z.string().optional(),
    client_uri: z.string().optional(),
    token_endpoint_auth_method: z.string().optional(),
  })
  .loose();

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => {
      throw new OAuthError('invalid_client_metadata', 'Body was not JSON.');
    });

    const parsed = registration.safeParse(raw);
    if (!parsed.success) {
      throw new OAuthError(
        'invalid_client_metadata',
        'redirect_uris is required and must be an array of URIs.',
      );
    }

    const { client, secret } = await registerClient({
      redirectUris: parsed.data.redirect_uris,
      clientName: parsed.data.client_name,
      logoUri: parsed.data.logo_uri,
      clientUri: parsed.data.client_uri,
      tokenEndpointAuthMethod: parsed.data.token_endpoint_auth_method,
    });

    return Response.json(
      {
        client_id: client.id,
        // Omitted entirely for a public client, which is how a client tells
        // that it is expected to authenticate with PKCE alone.
        ...(secret
          ? { client_secret: secret, client_secret_expires_at: 0 }
          : {}),
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.name,
        redirect_uris: client.redirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: secret ? 'client_secret_post' : 'none',
        scope: SCOPE,
      },
      { status: 201, headers: corsHeaders() },
    );
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
