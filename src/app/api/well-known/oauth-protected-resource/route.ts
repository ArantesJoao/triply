import { corsHeaders, mcpResource, originFor, SCOPE } from '@/server/oauth';

/**
 * RFC 9728 protected resource metadata — the first thing a client fetches
 * after `/api/mcp` turns it away, and how it learns where to go to get a token.
 *
 * Reached at `/.well-known/oauth-protected-resource` and at the path-inserted
 * form `/.well-known/oauth-protected-resource/api/mcp`, both rewritten here in
 * `next.config.ts`. There is one protected resource, so both answer the same.
 */
export async function GET(req: Request) {
  const origin = originFor(req);

  return Response.json(
    {
      resource: mcpResource(origin),
      authorization_servers: [origin],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'trip.ly',
      resource_documentation: `${origin}/docs`,
    },
    { headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
