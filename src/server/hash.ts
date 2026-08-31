import { createHash } from 'node:crypto';

/**
 * Every credential this app issues — API tokens, OAuth codes, access and
 * refresh tokens, client secrets — is stored only as this digest, so a
 * database dump hands over nothing that can be presented back to us.
 *
 * Lives on its own rather than in `access.ts` because the OAuth server needs
 * it too, and a shared leaf module is better than a cycle between them.
 */
export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
