import { customAlphabet } from 'nanoid';

// Unambiguous alphabet: no look-alike characters, so ids stay readable when
// someone pastes one into a Claude conversation or an API call by hand.
const alphabet = '23456789abcdefghijkmnpqrstuvwxyz';

const nano = customAlphabet(alphabet, 12);
const nanoShort = customAlphabet(alphabet, 8);
const nanoToken = customAlphabet(
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',
  40,
);

export const newTripId = () => `trip_${nanoShort()}`;
export const newCityId = () => `city_${nano()}`;
export const newColumnId = () => `col_${nano()}`;
export const newItemId = () => `item_${nano()}`;
export const newInviteId = () => `inv_${nano()}`;
export const newTokenId = () => `tok_${nano()}`;
export const newOAuthClientId = () => `tcl_${nano()}`;
export const newGrantId = () => `grant_${nano()}`;

/** Secret half of a /join/<token> link. */
export const newShareToken = () => nanoShort() + nanoShort();

/** Plaintext API token. Shown once, then only its hash is kept. */
export const newApiToken = () => `triply_${nanoToken()}`;

/**
 * OAuth secrets. Every one is stored only as a SHA-256 hash, like the API
 * tokens above.
 *
 * The prefixes are load-bearing, not decoration: `tokenActor` routes a bearer
 * to the right table by looking at it, so an access token can be told from a
 * personal token in one query rather than two. Keep them distinct from the
 * bare `triply_` of a personal token, which is the fallback.
 */
export const newOAuthSecret = () => `triply_cs_${nanoToken()}`;
export const newAuthCode = () => `triply_ac_${nanoToken()}`;
export const OAUTH_ACCESS_PREFIX = 'triply_at_';
export const newAccessToken = () => `${OAUTH_ACCESS_PREFIX}${nanoToken()}`;
export const newRefreshToken = () => `triply_rt_${nanoToken()}`;

/**
 * Human-readable handle for a city or column, unique within its parent.
 * "St James's Park" -> "st-james-s-park".
 */
export function slugify(input: string, fallback = 'item'): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

/** Appends -2, -3, ... until the slug is free within `taken`. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
