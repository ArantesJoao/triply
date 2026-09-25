import { asc, eq } from 'drizzle-orm';

import { db, geocodeCache, items } from '@/lib/db';
import {
  cleanStops,
  DEFAULT_TRAVEL_MODE,
  isTravelMode,
  mapsPinFor,
  mapsUrlFor,
  qualify,
  type TravelMode,
} from '@/lib/maps';

import { resolveColumn } from './board';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Identifies the app to both free services below, per their usage policies —
 * an anonymous User-Agent gets Nominatim requests blocked outright, and is
 * just good manners toward routing.openstreetmap.de's volunteer-run server.
 */
const USER_AGENT = 'trip.ly (personal trip planner, self-hosted)';

type LatLng = { lat: number; lng: number };

/**
 * Nominatim's usage policy caps free use at one request per second. Every
 * call in this process shares one clock, since a day's stops are geocoded in
 * a loop and a burst of misses would otherwise fire at once.
 */
let earliestNextRequest = 0;
async function throttle() {
  const wait = earliestNextRequest - Date.now();
  earliestNextRequest = Math.max(earliestNextRequest, Date.now()) + 1100;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

async function fetchFromNominatim(query: string): Promise<LatLng | null> {
  await throttle();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;

  const results = (await res.json()) as { lat: string; lon: string }[];
  const [first] = results;
  return first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
}

/**
 * Coordinates for a place name, geocoded once and cached forever after —
 * including a miss, so a stop Nominatim can't find is remembered as such
 * rather than retried on every map open.
 */
async function geocode(query: string): Promise<LatLng | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;

  const [cached] = await db
    .select()
    .from(geocodeCache)
    .where(eq(geocodeCache.query, key))
    .limit(1);

  if (cached) {
    return cached.lat != null && cached.lng != null
      ? { lat: cached.lat, lng: cached.lng }
      : null;
  }

  const found = await fetchFromNominatim(query);

  await db
    .insert(geocodeCache)
    .values({ query: key, lat: found?.lat ?? null, lng: found?.lng ?? null })
    .onConflictDoNothing();

  return found;
}

/* ------------------------------------------------------------------ *
 * Road-following routes, via the FOSSGIS-run public OSRM instance at
 * routing.openstreetmap.de — free, keyless, one profile per travel mode.
 * There is no free equivalent for transit, so that mode has no profile and
 * the day map falls back to a straight line between pins on the client.
 * ------------------------------------------------------------------ */

type OsrmProfile = 'foot' | 'bike' | 'car';

const OSRM_ROUTE_URL: Record<OsrmProfile, string> = {
  foot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  bike: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike',
  car: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
};

const OSRM_PROFILE_FOR_MODE: Record<TravelMode, OsrmProfile | null> = {
  walking: 'foot',
  bicycling: 'bike',
  driving: 'car',
  transit: null,
};

/**
 * The polyline for a route through `points`, in the given order — OSRM's
 * `route` service (not `trip`) keeps the waypoint order it's given rather
 * than reordering for a shortest tour, which is what a day plan wants. Null
 * on anything short of a full match: fewer than two points, a mode with no
 * free profile, or the request failing outright — callers fall back to a
 * straight line rather than surfacing a routing error over a day plan.
 */
async function routeThrough(
  mode: TravelMode,
  points: LatLng[],
): Promise<[number, number][] | null> {
  const profile = OSRM_PROFILE_FOR_MODE[mode];
  if (!profile || points.length < 2) return null;

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM_ROUTE_URL[profile]}/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      routes?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    const line = data.routes?.[0]?.geometry?.coordinates;
    // OSRM speaks [lng, lat]; Leaflet wants [lat, lng].
    return line ? line.map(([lng, lat]) => [lat, lng]) : null;
  } catch {
    return null;
  }
}

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
  /** Road-following polyline through `pins`, in order; null when none could be drawn. */
  route: [number, number][] | null;
  /** One Google Maps link carrying every pin as a stop, in order. */
  routeUrl: string | null;
};

/**
 * One pin per item in a day column, in board order — the first stop of each
 * activity's route stands for the whole thing, since that's the door you'd
 * actually walk up to — plus the road-following line through them and a
 * single Google Maps link for the whole day.
 *
 * A card with no stops only gets a pin when it's explicitly marked
 * `isPlace: true` — see that column's own doc comment in `src/lib/db/schema.ts`
 * and `itemProperties.isPlace` in `src/app/api/mcp/route.ts` for why: a title
 * is never as deliberate a place name as a typed-in stop ("Lunch" geocodes
 * just fine, to whichever obscure business happens to be named that), so
 * trip.ly asks rather than guesses. `isPlace: false` or `null` — including
 * every card that predates this field — is treated the same: not a place,
 * no pin, no geocoding attempted at all.
 */
export async function geocodeColumn(
  tripId: string,
  columnRef: string,
): Promise<DayMap> {
  const { column, city } = await resolveColumn(tripId, columnRef);

  const rows = await db
    .select()
    .from(items)
    .where(eq(items.columnId, column.id))
    .orderBy(asc(items.position), asc(items.createdAt));

  const pins: DayPin[] = [];
  // The same place text a pin was geocoded from, parallel to `pins` — what
  // the day's Google Maps link is built from, so the two never disagree
  // about which stop sits where.
  const places: string[] = [];
  const modeVotes = new Map<TravelMode, number>();

  for (const row of rows) {
    const stops = cleanStops(row.stops);
    const travelMode = isTravelMode(row.travelMode) ? row.travelMode : null;

    if (stops.length) {
      const coords = await geocode(qualify(stops[0], city.title));
      if (!coords) continue;

      pins.push({
        itemId: row.id,
        title: row.title || stops[0],
        time: row.time,
        lat: coords.lat,
        lng: coords.lng,
        mapsUrl: mapsUrlFor(stops, { city: city.title, travelMode }),
      });
      places.push(stops[0]);
      modeVotes.set(
        travelMode ?? DEFAULT_TRAVEL_MODE,
        (modeVotes.get(travelMode ?? DEFAULT_TRAVEL_MODE) ?? 0) + 1,
      );
      continue;
    }

    if (row.isPlace !== true) continue;

    const title = row.title.trim();
    if (!title) continue;

    const coords = await geocode(qualify(title, city.title));
    if (!coords) continue;

    pins.push({
      itemId: row.id,
      title,
      time: row.time,
      lat: coords.lat,
      lng: coords.lng,
      mapsUrl: mapsPinFor(title, city.title),
    });
    places.push(title);
    // A stop-less card has no travel mode of its own to vote with.
  }

  // Whichever mode most of the day's activities travel by wins the profile
  // for the connecting line — a day map has one route, not one per leg.
  const dominantMode =
    [...modeVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    DEFAULT_TRAVEL_MODE;

  const route = await routeThrough(
    dominantMode,
    pins.map((pin) => ({ lat: pin.lat, lng: pin.lng })),
  );

  return {
    pins,
    route,
    routeUrl: mapsUrlFor(places, { city: city.title, travelMode: dominantMode }),
  };
}
