/**
 * Tag → icon mapping.
 *
 * Thirty-one travel-shaped icons, grouped for the picker. Like `tag-colors`, the
 * resolution is layered: an explicit per-trip override wins, otherwise a
 * keyword match on the tag name supplies one for free, otherwise the chip
 * falls back to its plain coloured dot.
 *
 * This module is deliberately free of React / lucide imports so the API
 * schemas and server code can validate keys without pulling icon components
 * into the server bundle. The key → component registry lives in
 * `@/components/ui/tag-icon`.
 */

export const TAG_ICON_KEYS = [
  // Food & drink
  'utensils', 'coffee', 'wine', 'beer', 'pizza', 'ice-cream-cone',
  // Sights & culture
  'landmark', 'church', 'castle', 'camera', 'palette', 'theater', 'music',
  'football',
  // Outdoors
  'mountain', 'trees', 'waves', 'sun', 'tent', 'footprints',
  // Getting around
  'plane', 'train-front', 'bus', 'car', 'ship', 'bike',
  // Practical
  'bed-double', 'shopping-bag', 'ticket', 'heart', 'sparkles',
] as const;

export type TagIconKey = (typeof TAG_ICON_KEYS)[number];

/** Picker layout — the same order as `TAG_ICON_KEYS`, split into rows. */
export const TAG_ICON_GROUPS: { label: string; keys: TagIconKey[] }[] = [
  {
    label: 'Food & drink',
    keys: ['utensils', 'coffee', 'wine', 'beer', 'pizza', 'ice-cream-cone'],
  },
  {
    label: 'Sights & culture',
    keys: [
      'landmark', 'church', 'castle', 'camera',
      'palette', 'theater', 'music', 'football',
    ],
  },
  {
    label: 'Outdoors',
    keys: ['mountain', 'trees', 'waves', 'sun', 'tent', 'footprints'],
  },
  {
    label: 'Getting around',
    keys: ['plane', 'train-front', 'bus', 'car', 'ship', 'bike'],
  },
  {
    label: 'Practical',
    keys: ['bed-double', 'shopping-bag', 'ticket', 'heart', 'sparkles'],
  },
];

const KEY_SET: ReadonlySet<string> = new Set(TAG_ICON_KEYS);

/** Narrows an untrusted string (DB jsonb, API body) to a known icon key. */
export function isTagIconKey(value: unknown): value is TagIconKey {
  return typeof value === 'string' && KEY_SET.has(value);
}

/**
 * Word → icon. Matched per word of the tag name rather than by substring, so
 * `sunday dinner` finds `utensils` without `art` hijacking `start`.
 * English only for now; add other languages here as they come up.
 */
const KEYWORDS: Record<string, TagIconKey> = {};

function keywords(key: TagIconKey, ...words: string[]) {
  for (const word of words) KEYWORDS[word] = key;
}

keywords('utensils', 'food', 'eat', 'meal', 'lunch', 'dinner', 'restaurant', 'dining', 'brunch', 'tapas', 'ramen', 'sushi');
keywords('coffee', 'coffee', 'cafe', 'café', 'espresso', 'breakfast', 'tea', 'bakery', 'pastry');
keywords('wine', 'wine', 'winery', 'vineyard', 'cellar');
keywords('beer', 'beer', 'bar', 'pub', 'brewery', 'drinks', 'cocktails', 'nightlife');
keywords('pizza', 'pizza', 'pizzeria', 'trattoria', 'pasta');
keywords('ice-cream-cone', 'gelato', 'icecream', 'dessert', 'sweets', 'treat');
keywords('landmark', 'landmark', 'museum', 'monument', 'history', 'historic', 'ruins', 'sight', 'sightseeing', 'gallery');
keywords('church', 'church', 'cathedral', 'temple', 'mosque', 'shrine', 'basilica', 'chapel');
keywords('castle', 'castle', 'palace', 'fortress', 'fort', 'citadel');
keywords('camera', 'photo', 'photography', 'viewpoint', 'view', 'lookout', 'scenic');
keywords('palette', 'art', 'exhibition', 'design', 'mural');
keywords('theater', 'theatre', 'theater', 'show', 'opera', 'cinema', 'movie', 'play');
keywords('music', 'music', 'concert', 'gig', 'festival', 'jazz', 'club', 'clubbing');
keywords('football', 'stadium', 'football', 'soccer', 'match', 'game', 'arena', 'sport', 'derby', 'kickoff', 'terrace', 'pitch');
keywords('mountain', 'mountain', 'hike', 'hiking', 'trail', 'trek', 'trekking', 'climb', 'summit', 'ski', 'skiing');
keywords('trees', 'park', 'garden', 'forest', 'nature', 'botanical', 'picnic');
keywords('waves', 'beach', 'sea', 'ocean', 'swim', 'swimming', 'surf', 'surfing', 'lake', 'river', 'pool', 'diving', 'snorkel');
keywords('sun', 'sunset', 'sunrise', 'summer', 'chill', 'relax', 'rest', 'spa');
keywords('tent', 'camp', 'camping', 'campsite', 'glamping', 'outdoors');
keywords('footprints', 'walk', 'walking', 'stroll', 'wander', 'tour', 'explore', 'neighbourhood', 'neighborhood');
keywords('plane', 'flight', 'fly', 'flying', 'plane', 'airport', 'departure', 'arrival', 'layover');
keywords('train-front', 'train', 'rail', 'railway', 'metro', 'subway', 'tram', 'station');
keywords('bus', 'bus', 'coach', 'shuttle', 'transfer', 'transit', 'transport');
keywords('car', 'car', 'drive', 'driving', 'roadtrip', 'rental', 'taxi', 'uber', 'parking');
keywords('ship', 'boat', 'ferry', 'cruise', 'sail', 'sailing', 'kayak', 'harbour', 'harbor', 'port');
keywords('bike', 'bike', 'biking', 'bicycle', 'cycling', 'scooter');
keywords('bed-double', 'hotel', 'hostel', 'stay', 'sleep', 'accommodation', 'airbnb', 'checkin', 'checkout', 'lodging');
keywords('shopping-bag', 'shopping', 'shop', 'market', 'souvenir', 'mall', 'boutique', 'gifts');
keywords('ticket', 'ticket', 'booked', 'booking', 'book', 'reservation', 'reserved', 'entry', 'pass');
keywords('heart', 'favourite', 'favorite', 'must', 'love', 'romantic', 'date', 'highlight');
keywords('sparkles', 'maybe', 'idea', 'optional', 'bonus', 'wishlist', 'special', 'splurge', 'fancy');

/** Looks a word up, retrying without a trailing plural `s`. */
function lookup(word: string): TagIconKey | null {
  if (KEYWORDS[word]) return KEYWORDS[word];
  if (word.endsWith('s') && KEYWORDS[word.slice(0, -1)]) {
    return KEYWORDS[word.slice(0, -1)];
  }
  return null;
}

/** Best-effort icon for a tag name, from its words. Never persisted. */
export function guessTagIcon(tag: string): TagIconKey | null {
  const normalised = tag.trim().toLowerCase();
  if (!normalised) return null;

  const direct = lookup(normalised);
  if (direct) return direct;

  for (const word of normalised.split(/[^\p{L}\p{N}]+/u)) {
    const hit = word && lookup(word);
    if (hit) return hit;
  }
  return null;
}

/**
 * Resolves the icon for a tag: explicit override first, keyword guess second,
 * `null` (plain dot) last. An override of `''` means "no icon", so a user can
 * clear a guess they don't like — that's why the guess is skipped whenever the
 * tag has an entry at all.
 */
export function tagIconKey(
  tag: string,
  overrides?: Record<string, string>,
): TagIconKey | null {
  if (overrides && tag in overrides) {
    const chosen = overrides[tag];
    return isTagIconKey(chosen) ? chosen : null;
  }
  return guessTagIcon(tag);
}
