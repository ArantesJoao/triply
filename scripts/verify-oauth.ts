/**
 * Round-trips the OAuth flow against the real database: register, authorize,
 * redeem, resolve, refresh, revoke. Creates one throwaway client and deletes
 * it (and everything cascading from it) at the end.
 *
 *   npx tsx scripts/verify-oauth.ts
 */
import { createHash, randomBytes } from 'node:crypto';

import { config } from 'dotenv';

config({ path: process.env.ENV_FILE ?? '.env.local', quiet: true });
config({ path: '.env', quiet: true });

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`, detail ?? '');
  }
}

async function rejects(label: string, run: () => Promise<unknown>) {
  try {
    await run();
    check(label, false, 'expected a rejection');
  } catch {
    check(label, true);
  }
}

async function main() {
  const { db, oauthClients, users } = await import('../src/lib/db');
  const { eq } = await import('drizzle-orm');
  const oauth = await import('../src/server/oauth');

  const [user] = await db.select({ id: users.id }).from(users).limit(1);
  if (!user) throw new Error('No users in this database; run npm run seed.');

  // --- redirect URI rules ------------------------------------------------
  check('https redirect allowed', oauth.isAllowedRedirectUri('https://claude.ai/cb'));
  check('loopback http allowed', oauth.isAllowedRedirectUri('http://127.0.0.1:9000/cb'));
  check('private scheme allowed', oauth.isAllowedRedirectUri('vscode://claude/cb'));
  check('remote http refused', !oauth.isAllowedRedirectUri('http://evil.test/cb'));
  check('javascript refused', !oauth.isAllowedRedirectUri('javascript:alert(1)'));
  check('fragment refused', !oauth.isAllowedRedirectUri('https://ok.test/cb#x'));
  check(
    'loopback port floats',
    oauth.matchesRegisteredUri('http://127.0.0.1:1/cb', 'http://127.0.0.1:54321/cb'),
  );
  check(
    'https port does not float',
    !oauth.matchesRegisteredUri('https://a.test:1/cb', 'https://a.test:2/cb'),
  );

  // --- register ----------------------------------------------------------
  const { client, secret } = await oauth.registerClient({
    redirectUris: ['http://127.0.0.1:7777/callback', 'http://evil.test/cb'],
    clientName: 'verify-oauth throwaway',
  });
  check('client registered', Boolean(client.id));
  check('secret issued', Boolean(secret));
  check('bad redirect dropped', client.redirectUris.length === 1);

  try {
    // --- authorize -------------------------------------------------------
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const redirectUri = 'http://127.0.0.1:7777/callback';

    const code = await oauth.issueCode({
      clientId: client.id,
      userId: user.id,
      redirectUri,
      codeChallenge: challenge,
      resource: 'https://planwithtriply.com/api/mcp',
    });
    check('code issued', code.startsWith('triply_ac_'));

    // --- PKCE is enforced -------------------------------------------------
    await rejects('wrong verifier refused', () =>
      oauth.redeemCode({
        code,
        clientId: client.id,
        redirectUri,
        codeVerifier: 'not-the-verifier',
      }),
    );
    // ...and that failed attempt consumed the code, single-use as intended.
    await rejects('code is single use', () =>
      oauth.redeemCode({ code, clientId: client.id, redirectUri, codeVerifier: verifier }),
    );

    // --- redeem -----------------------------------------------------------
    const fresh = await oauth.issueCode({
      clientId: client.id,
      userId: user.id,
      redirectUri,
      codeChallenge: challenge,
      resource: null,
    });
    const tokens = await oauth.redeemCode({
      code: fresh,
      clientId: client.id,
      redirectUri,
      codeVerifier: verifier,
    });
    check('access token minted', tokens.access_token.startsWith('triply_at_'));
    check('refresh token minted', tokens.refresh_token.startsWith('triply_rt_'));
    check('expires_in is positive', tokens.expires_in > 0);

    // --- resolve ----------------------------------------------------------
    const grant = await oauth.grantForAccessToken(tokens.access_token);
    check('access token resolves to the user', grant?.userId === user.id);
    check(
      'a made-up token resolves to nothing',
      (await oauth.grantForAccessToken('triply_at_nope')) === null,
    );

    const connections = await oauth.listConnections(user.id);
    check(
      'grant is listed as a connection',
      connections.some((row) => row.id === grant?.id),
    );

    // --- refresh ----------------------------------------------------------
    const rolled = await oauth.refreshGrant({
      refreshToken: tokens.refresh_token,
      clientId: client.id,
    });
    check('refresh returns a new access token', rolled.access_token !== tokens.access_token);
    check(
      'old access token is dead',
      (await oauth.grantForAccessToken(tokens.access_token)) === null,
    );
    check(
      'new access token works',
      (await oauth.grantForAccessToken(rolled.access_token))?.userId === user.id,
    );
    await rejects('rotated refresh token is dead', () =>
      oauth.refreshGrant({ refreshToken: tokens.refresh_token, clientId: client.id }),
    );
    await rejects('refresh refused for another client', () =>
      oauth.refreshGrant({ refreshToken: rolled.refresh_token, clientId: 'tcl_nobody' }),
    );

    // --- revoke -----------------------------------------------------------
    await oauth.revokeByToken(rolled.refresh_token);
    check(
      'revoking the refresh token kills the access token',
      (await oauth.grantForAccessToken(rolled.access_token)) === null,
    );
  } finally {
    await db.delete(oauthClients).where(eq(oauthClients.id, client.id));
    console.log('  --   throwaway client deleted');
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
