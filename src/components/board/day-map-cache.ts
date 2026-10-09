/**
 * Client-side cache for a day's geocoded map, keyed by column id.
 *
 * The expensive part of building a day map isn't the request itself — it's
 * that a stop Nominatim hasn't seen before costs a throttled ~1.1s on the
 * server (its usage policy caps free lookups at one per second). Fetching a
 * column's map is idempotent and the result barely changes minute to minute,
 * so every caller — the background prefetch below and the dialog itself —
 * shares one in-flight/resolved promise per column instead of each paying
 * that cost, or a repeat visitor paying it twice.
 *
 * Lives only for the page's lifetime: a reload clears it, same as any other
 * in-memory cache, while the server's own geocode cache (Postgres) is what
 * keeps a reload fast regardless.
 */

export type DayPin = {
  itemId: string;
  title: string;
  time: string | null;
  lat: number;
  lng: number;
  mapsUrl: string | null;
};

export type DayMap = {
  pins: DayPin[];
  route: [number, number][] | null;
  routeUrl: string | null;
};

const cache = new Map<string, Promise<DayMap>>();

export function fetchDayMap(tripId: string, columnId: string): Promise<DayMap> {
  const cached = cache.get(columnId);
  if (cached) return cached;

  const request = fetch(`/api/trips/${tripId}/columns/${columnId}/map`).then((res) => {
    if (!res.ok) throw new Error('map lookup failed');
    return res.json() as Promise<DayMap>;
  });

  // A failed fetch doesn't poison the cache — the dialog itself is what
  // matters most, so its own retry (opening the dialog again) should get a
  // fresh attempt rather than the same rejected promise forever.
  request.catch(() => cache.delete(columnId));

  cache.set(columnId, request);
  return request;
}

/**
 * Drops a column's cached map, so the next {@link fetchDayMap} asks the server
 * again — for a change the map has to reflect, like a card marked done.
 */
export function forgetDayMap(columnId: string) {
  cache.delete(columnId);
}

/**
 * Warms every column's map in the background, one at a time. Sequential on
 * purpose: the server's Nominatim throttle only serializes calls within one
 * request, so firing every column's request at once could still land on
 * separate serverless instances and burst past the 1-per-second cap between
 * them. One column in flight at a time keeps that guarantee no matter how
 * many instances are involved.
 */
export function prefetchDayMaps(tripId: string, columnIds: string[]) {
  void (async () => {
    for (const columnId of columnIds) {
      try {
        await fetchDayMap(tripId, columnId);
      } catch {
        // Best-effort — a column that fails to prefetch just falls back to
        // fetching on demand when its dialog is opened.
      }
    }
  })();
}
