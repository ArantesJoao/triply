import { createHash, timingSafeEqual } from 'node:crypto';

import { and, desc, eq, lt } from 'drizzle-orm';

import { db, oauthClients, oauthCodes, oauthGrants } from '@/lib/db';
import {
  newAccessToken,
  newAuthCode,
  newGrantId,
  newOAuthClientId,
  newOAuthSecret,
  newRefreshToken,
} from '@/lib/ids';

import { hashToken } from './hash';

/**
 * The OAuth 2.1 authorization server behind the MCP endpoint.
 *
 * trip.ly is its own authorization server and its own resource server, which
 * keeps this small: tokens are opaque random strings checked against a table
 * on every request, so there is nothing to sign, no key to rotate, and no
 * introspection endpoint. Revocation is a row delete and takes effect on the
 * next call.
 *
 * Google is still the only way anyone proves who they are. The authorize
 * endpoint runs behind the ordinary browser session, so signing in inside this
 * flow is the same sign-in as everywhere else.
 *
 * The pieces, all of them standard:
 *
 *   RFC 9728  /.well-known/oauth-protected-resource   what guards /api/mcp
 *   RFC 8414  /.well-known/oauth-authorization-server the endpoints below
 *   RFC 7591  POST /api/oauth/register                a client enrols itself
 *   RFC 6749  GET  /oauth/authorize                   consent, then a code
 *             POST /api/oauth/token                   code or refresh
 *   RFC 7636  PKCE S256, required on every authorization
 *   RFC 7009  POST /api/oauth/revoke
 */

/**
 * One scope, because there is one thing to grant: the trips you can already
 * reach. A connected app acts with exactly your access and no more — the same
 * deal an API token makes. Splitting it read/write would be a promise the
 * board service layer is not structured to keep.
 */
export const SCOPE = 'triply';

/**
 * Thirty days, which costs nothing in revocation latency: tokens are checked
 * against the database on every request, so a revoked grant dies immediately
 * whatever the expiry says. The clock only bounds how long a leaked token
 * stays useful.
 */
const ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Long enough to sign in and read the consent screen, useless soon after. */
const CODE_TTL_MS = 5 * 60 * 1000;

export type OAuthClient = typeof oauthClients.$inferSelect;

/* ------------------------------------------------------------------ *
 * Origin
 * ------------------------------------------------------------------ */

/**
 * The canonical origin: the issuer, the base of every advertised endpoint, and
 * half of the resource identifier.
 *
 * RFC 8414 requires the issuer to match the URL the metadata was fetched from,
 * so a preview deployment has to describe itself rather than production —
 * hence the fall back to the request host when NEXT_PUBLIC_APP_URL is unset.
 */
export function originFromHeaders(headers: Headers, fallback?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) return configured;

  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return fallback ? new URL(fallback).origin : '';

  const proto =
    headers.get('x-forwarded-proto') ??
    (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https');

  return `${proto}://${host}`;
}

export const originFor = (request: Request) =>
  originFromHeaders(request.headers, request.url);

export const mcpResource = (origin: string) => `${origin}/api/mcp`;

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

/** An OAuth failure, rendered as the `error` field RFC 6749 section 5.2 defines. */
export class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export function oauthErrorResponse(error: unknown) {
  const known =
    error instanceof OAuthError
      ? error
      : new OAuthError('server_error', 'Something went wrong.', 500);

  if (!(error instanceof OAuthError)) console.error('[oauth]', error);

  return Response.json(
    { error: known.code, error_description: known.message },
    { status: known.status, headers: corsHeaders() },
  );
}

/**
 * Discovery, registration and token endpoints get fetched cross-origin,
 * including by browser-based clients, so they answer to anybody. Nothing they
 * return is secret and nothing they do is authorized by a cookie, so there is
 * no cross-origin authority to hand away. The authorize endpoint is
 * deliberately not in this set: it is cookie-authenticated, and it is a page.
 */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/* ------------------------------------------------------------------ *
 * Redirect URIs
 * ------------------------------------------------------------------ */

const DANGEROUS_SCHEMES = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
]);

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Where a client may be sent back to. Three shapes, which is what RFC 8252
 * expects of hosted and native clients both:
 *
 *   https://...              a hosted client, e.g. Claude on the web
 *   http://127.0.0.1:1234    a native client listening on loopback
 *   myapp://callback         a private-use scheme claimed by a desktop app
 *
 * Plain http to anywhere but loopback is refused: a code delivered over that
 * is a code delivered to the network. So are script-bearing schemes, which
 * would make the redirect an injection sink on whatever page opened it.
 */
export function isAllowedRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.hash) return false;
  if (DANGEROUS_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === 'https:') return true;
  if (url.protocol === 'http:') return LOOPBACK.has(url.hostname);
  return true;
}

/**
 * Exact match, with the one carve-out RFC 8252 section 7.3 requires: a native
 * client's loopback port is whatever was free when it started, so it cannot be
 * known at registration time. Everything else about the URI must still agree.
 */
export function matchesRegisteredUri(registered: string, presented: string) {
  if (registered === presented) return true;

  try {
    const a = new URL(registered);
    const b = new URL(presented);
    return (
      a.protocol === 'http:' &&
      b.protocol === 'http:' &&
      LOOPBACK.has(a.hostname) &&
      a.hostname === b.hostname &&
      a.pathname === b.pathname &&
      a.search === b.search
    );
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Clients
 * ------------------------------------------------------------------ */

export type RegistrationInput = {
  redirectUris: string[];
  clientName?: string;
  logoUri?: string;
  clientUri?: string;
  /** `none` makes a public client, authenticated by PKCE alone. */
  tokenEndpointAuthMethod?: string;
};

/**
 * RFC 7591 dynamic registration, open to anyone.
 *
 * Less of a hole than it looks. Registering buys a client nothing on its own:
 * no token comes out of it until a signed-in person reads the consent screen
 * and presses Allow, and the code that follows can only be delivered to a URI
 * fixed here, at registration. Open registration is also the entire point of
 * the exercise — a client someone installed five minutes ago has no other way
 * to introduce itself.
 */
export async function registerClient(input: RegistrationInput) {
  const uris = input.redirectUris.filter(isAllowedRedirectUri);

  if (uris.length === 0) {
    throw new OAuthError(
      'invalid_redirect_uri',
      'Provide at least one https, loopback http, or private-scheme redirect_uri.',
    );
  }
  if (uris.length > 10) {
    throw new OAuthError('invalid_client_metadata', 'Too many redirect_uris.');
  }

  const isPublic = input.tokenEndpointAuthMethod === 'none';
  const secret = isPublic ? null : newOAuthSecret();

  const [client] = await db
    .insert(oauthClients)
    .values({
      id: newOAuthClientId(),
      secretHash: secret ? hashToken(secret) : null,
      name: input.clientName?.trim().slice(0, 120) || 'An application',
      redirectUris: uris,
      logoUri: input.logoUri ?? null,
      clientUri: input.clientUri ?? null,
    })
    .returning();

  return { client, secret };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const [client] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.id, clientId))
    .limit(1);
  return client ?? null;
}

/**
 * Checks a client secret without leaking how much of it was right. A plain
 * comparison on a hash is a timing oracle, cheap as this is to close.
 */
function secretMatches(client: OAuthClient, presented: string | undefined) {
  if (!client.secretHash) return true; // public client: PKCE is the proof
  if (!presented) return false;

  const expected = Buffer.from(client.secretHash, 'hex');
  const actual = Buffer.from(hashToken(presented), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Resolves the client on a token request. A public client identifies itself
 * with `client_id` alone; a confidential one must also present its secret, by
 * either of the two methods the metadata advertises.
 */
export async function authenticateClient(
  clientId: string | undefined,
  clientSecret: string | undefined,
): Promise<OAuthClient> {
  if (!clientId) {
    throw new OAuthError('invalid_client', 'client_id is required.', 401);
  }

  const client = await getClient(clientId);
  if (!client || !secretMatches(client, clientSecret)) {
    throw new OAuthError('invalid_client', 'Unknown client or bad secret.', 401);
  }
  return client;
}

/* ------------------------------------------------------------------ *
 * Authorization codes
 * ------------------------------------------------------------------ */

/** base64url(SHA-256(verifier)) — the only PKCE method we accept. */
const s256 = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

export async function issueCode(params: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string | null;
}) {
  const code = newAuthCode();

  // Sweep dead codes on the way past. There are never many, and it saves
  // standing up a cron for a table that empties itself in five minutes.
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, new Date()));

  await db.insert(oauthCodes).values({
    codeHash: hashToken(code),
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    scope: SCOPE,
    resource: params.resource,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  return code;
}

/**
 * Redeems a code for a grant.
 *
 * The delete is the read: a code is consumed by the same statement that finds
 * it, so two simultaneous redemptions cannot both win and a replay finds
 * nothing. The rest is RFC 6749 section 4.1.3 — the code must belong to this
 * client, come back to the same redirect_uri, still be alive, and carry a PKCE
 * verifier hashing to the challenge it was minted with.
 */
export async function redeemCode(params: {
  code: string;
  clientId: string;
  redirectUri: string | undefined;
  codeVerifier: string | undefined;
}) {
  const [row] = await db
    .delete(oauthCodes)
    .where(eq(oauthCodes.codeHash, hashToken(params.code)))
    .returning();

  const invalid = (why: string) => new OAuthError('invalid_grant', why);

  if (!row) throw invalid('That authorization code is not valid.');
  if (row.clientId !== params.clientId) {
    throw invalid('That code was issued to a different client.');
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw invalid('That authorization code has expired.');
  }
  if (params.redirectUri && params.redirectUri !== row.redirectUri) {
    throw invalid('redirect_uri does not match the authorization request.');
  }
  if (!params.codeVerifier) {
    throw new OAuthError('invalid_request', 'code_verifier is required.');
  }
  if (s256(params.codeVerifier) !== row.codeChallenge) {
    throw invalid('code_verifier does not match the code_challenge.');
  }

  return issueGrant({ clientId: row.clientId, userId: row.userId });
}

/* ------------------------------------------------------------------ *
 * Grants
 * ------------------------------------------------------------------ */

function tokenPayload(access: string, refresh: string, expiresAt: Date) {
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    refresh_token: refresh,
    scope: SCOPE,
  };
}

/**
 * One row per connected app per person — the thing Settings lists. Connecting
 * the same client twice deliberately makes a second grant rather than
 * overwriting the first, so disconnecting a laptop does not sign out a phone.
 */
async function issueGrant(params: { clientId: string; userId: string }) {
  const access = newAccessToken();
  const refresh = newRefreshToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);

  await db.insert(oauthGrants).values({
    id: newGrantId(),
    clientId: params.clientId,
    userId: params.userId,
    accessTokenHash: hashToken(access),
    accessExpiresAt: expiresAt,
    refreshTokenHash: hashToken(refresh),
    scope: SCOPE,
  });

  return tokenPayload(access, refresh, expiresAt);
}

/**
 * Refresh, rotating the token in place as OAuth 2.1 asks for public clients.
 * Same row, new secrets: the connection keeps its identity in Settings and its
 * connected-since date across a year of refreshes, and revoking stays one
 * delete. A client that loses the response re-authorizes, which is the trade
 * rotation always makes.
 */
export async function refreshGrant(params: {
  refreshToken: string;
  clientId: string;
}) {
  const access = newAccessToken();
  const refresh = newRefreshToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);

  const [row] = await db
    .update(oauthGrants)
    .set({
      accessTokenHash: hashToken(access),
      accessExpiresAt: expiresAt,
      refreshTokenHash: hashToken(refresh),
      lastUsedAt: new Date(),
    })
    .where(
      and(
        eq(oauthGrants.refreshTokenHash, hashToken(params.refreshToken)),
        eq(oauthGrants.clientId, params.clientId),
      ),
    )
    .returning({ id: oauthGrants.id });

  if (!row) {
    throw new OAuthError('invalid_grant', 'That refresh token is not valid.');
  }

  return tokenPayload(access, refresh, expiresAt);
}

/**
 * Resolves an OAuth access token to the person who approved it. Null for
 * anything unknown or expired, so the caller can fall through to the other
 * ways of authenticating.
 */
export async function grantForAccessToken(token: string) {
  const [row] = await db
    .select({
      id: oauthGrants.id,
      userId: oauthGrants.userId,
      accessExpiresAt: oauthGrants.accessExpiresAt,
    })
    .from(oauthGrants)
    .where(eq(oauthGrants.accessTokenHash, hashToken(token)))
    .limit(1);

  if (!row || row.accessExpiresAt.getTime() < Date.now()) return null;

  // Fire-and-forget, as with API tokens: a failed stamp must not fail the call.
  void db
    .update(oauthGrants)
    .set({ lastUsedAt: new Date() })
    .where(eq(oauthGrants.id, row.id))
    .catch(() => {});

  return { id: row.id, userId: row.userId };
}

/**
 * RFC 7009. Either token kills the whole grant, which is what someone pressing
 * "disconnect" in a client means by it. Always reports success — the RFC says
 * an unknown token is not an error, and saying otherwise would turn this into
 * an oracle for guessing tokens.
 */
export async function revokeByToken(token: string) {
  const hash = hashToken(token);
  await db.delete(oauthGrants).where(eq(oauthGrants.accessTokenHash, hash));
  await db.delete(oauthGrants).where(eq(oauthGrants.refreshTokenHash, hash));
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export async function listConnections(userId: string) {
  return db
    .select({
      id: oauthGrants.id,
      name: oauthClients.name,
      clientUri: oauthClients.clientUri,
      lastUsedAt: oauthGrants.lastUsedAt,
      createdAt: oauthGrants.createdAt,
    })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
    .where(eq(oauthGrants.userId, userId))
    .orderBy(desc(oauthGrants.createdAt));
}

/** Scoped to the owner, so one person cannot disconnect another's client. */
export async function revokeConnection(userId: string, grantId: string) {
  await db
    .delete(oauthGrants)
    .where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.userId, userId)));
}
