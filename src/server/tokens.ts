import { and, desc, eq } from 'drizzle-orm';

import { apiTokens, db } from '@/lib/db';
import { newApiToken, newTokenId } from '@/lib/ids';

import { hashToken } from './hash';
import { notFound } from './errors';

export async function listTokens(userId: string) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
}

/**
 * Mints a token. The plaintext is returned exactly once — only its SHA-256
 * hash is stored, so a database dump doesn't hand over API access.
 */
export async function createToken(userId: string, name: string) {
  const token = newApiToken();
  const id = newTokenId();

  await db.insert(apiTokens).values({
    id,
    userId,
    name: name.trim() || 'API token',
    tokenHash: hashToken(token),
    prefix: token.slice(0, 12),
  });

  return { id, token };
}

export async function deleteToken(userId: string, tokenId: string) {
  const deleted = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id });

  if (deleted.length === 0) throw notFound('Token');
}
