/**
 * Turning an activity's stops into a Google Maps link.
 *
 * Stops are plain text — "Kingly Court", "Trafalgar Square" — and Google does
 * the geocoding. Nothing here talks to an API, needs a key, or stores
 * coordinates: a link is derived from the words on the card every time it is
 * asked for, so a stop that gets retyped can never drift from a pinned place
 * id that was resolved months earlier.
 *
 * The one place in the app that builds a Maps URL. The browser calls it for
 * the dialog's button; the server calls it so the REST API and the MCP hand
 * back a ready-made `mapsUrl` and a model never has to assemble one itself —
 * which is where it goes wrong, since the `/data=` payload in a URL copied out
 * of Maps is full of place ids and session tokens that cannot be invented.
 */

export const TRAVEL_MODES = ['walking', 'transit', 'driving', 'bicycling'] as const;

export type TravelMode = (typeof TRAVEL_MODES)[number];

/** Null in the database means walking; the field only exists to say otherwise. */
export const DEFAULT_TRAVEL_MODE: TravelMode = 'walking';

export const isTravelMode = (value: unknown): value is TravelMode =>
  typeof value === 'string' && (TRAVEL_MODES as readonly string[]).includes(value);

/**
 * How the path form spells a travel mode. Maps' own encoding rather than a
 * documented parameter — see the `>MAX_API_STOPS` branch below for why that
 * branch exists at all.
 */
const MODE_FLAG: Record<TravelMode, string> = {
  driving: '3e0',
  bicycling: '3e1',
  walking: '3e2',
  transit: '3e3',
};

/**
 * What the documented `?api=1` directions URL holds: an origin, a destination,
 * and nine waypoints between them.
 */
const MAX_API_STOPS = 11;

const BASE = 'https://www.google.com/maps';

/**
 * Drops blanks and trims, keeping order and repeats.
 *
 * Unlike tags, a route is a sequence: "Berwick Street" appearing twice is a
 * loop back through the market, not a duplicate to collapse, and lower-casing
 * would wreck the label the reader sees.
 */
export function cleanStops(stops: unknown): string[] {
  if (!Array.isArray(stops)) return [];
  const out: string[] = [];
  for (const stop of stops) {
    const clean = String(stop).trim();
    if (clean) out.push(clean);
  }
  return out;
}

/**
 * "Kingly Court" → "Kingly Court, London".
 *
 * The city is on the board already, so an agent writing stops should not have
 * to repeat it on every line — and a bare "Liberty" geocodes to somewhere in
 * Missouri. Only at link time: what was written is what stays stored, and what
 * the card shows.
 */
function qualify(stop: string, city?: string): string {
  if (!city) return stop;
  const trimmed = city.trim();
  if (!trimmed) return stop;
  return stop.toLowerCase().includes(trimmed.toLowerCase())
    ? stop
    : `${stop}, ${trimmed}`;
}

/** Maps' own path spelling: spaces as `+`, everything else percent-encoded. */
const pathSegment = (value: string) =>
  encodeURIComponent(value).replace(/%20/g, '+');

/**
 * The link for a route, or null when there is no route to link to.
 *
 * Three shapes, and the split is about what works on a phone. `?api=1` is
 * Google's documented cross-platform URL: it opens the Maps app on Android and
 * iOS with the travel mode intact, so it is used wherever it fits — which is
 * every route up to eleven stops. Past that its waypoint cap would silently
 * drop the middle of the walk, so a longer one falls back to the
 * `/maps/dir/A/B/C/` path form, which has no cap and still opens the app, at
 * the cost of carrying the mode as Maps' internal `data=` flag.
 */
export function mapsUrlFor(
  stops: string[] | null | undefined,
  { city, travelMode }: { city?: string; travelMode?: TravelMode | null } = {},
): string | null {
  const places = cleanStops(stops).map((stop) => qualify(stop, city));
  if (places.length === 0) return null;

  const mode = travelMode ?? DEFAULT_TRAVEL_MODE;

  // One stop is not a route — it is a place, and Maps has a form for that.
  if (places.length === 1) {
    const query = new URLSearchParams({ api: '1', query: places[0] });
    return `${BASE}/search/?${query}`;
  }

  if (places.length <= MAX_API_STOPS) {
    const query = new URLSearchParams({
      api: '1',
      origin: places[0],
      destination: places[places.length - 1],
      travelmode: mode,
    });
    const between = places.slice(1, -1);
    if (between.length) query.set('waypoints', between.join('|'));
    return `${BASE}/dir/?${query}`;
  }

  return `${BASE}/dir/${places.map(pathSegment).join('/')}/data=!4m2!4m1!${MODE_FLAG[mode]}`;
}

/** The link for a single stop — the pin behind each line of the read-mode list. */
export function mapsPinFor(stop: string, city?: string): string {
  const query = new URLSearchParams({ api: '1', query: qualify(stop.trim(), city) });
  return `${BASE}/search/?${query}`;
}

/** How a mode is named in the UI. */
export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  walking: 'Walk',
  transit: 'Transit',
  driving: 'Drive',
  bicycling: 'Bike',
};
