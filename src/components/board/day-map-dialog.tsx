'use client';

import 'leaflet/dist/leaflet.css';

import { Navigation } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';

import { fetchDayMap, type DayMap } from './day-map-cache';
import { useColumn, useTrip } from './store';

/** Google's own route-line blue — keeps the drawn line reading as "a route", not a brand accent. */
const ROUTE_COLOR = '#4285F4';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/**
 * The classic red teardrop, numbered for the day's running order instead of
 * left blank — an inline SVG rather than Leaflet's default marker image, so
 * there is no marker asset to bundle.
 */
const pinIcon = (L: typeof import('leaflet'), index: number) =>
  L.divIcon({
    className: '',
    html: `
      <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"
        style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 13.2 23.3 14.2 24.3a1.1 1.1 0 0 0 1.6 0C16.8 38.3 30 25.5 30 15 30 6.7 23.3 0 15 0z" fill="#EA4335"/>
        <circle cx="15" cy="15" r="10.5" fill="#ffffff"/>
        <text x="15" y="19.5" text-anchor="middle" font-size="12" font-weight="700"
          font-family="system-ui, sans-serif" fill="#EA4335">${index + 1}</text>
      </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
  });

/**
 * A day's stops, plotted on a free OpenStreetMap tile layer. Each pin is that
 * activity's first stop in board order — the door you'd walk up to — and its
 * popup links out to the real route in Google Maps, same link the card's own
 * route button uses.
 */
export function DayMapDialog({
  columnId,
  open,
  onClose,
}: {
  columnId: string;
  open: boolean;
  onClose: () => void;
}) {
  const column = useColumn(columnId);
  const trip = useTrip();
  const mapEl = useRef<HTMLDivElement>(null);
  const [dayMap, setDayMap] = useState<DayMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDayMap(null);
    setError(null);
    let cancelled = false;

    // Already warm from the background prefetch almost every time — this
    // resolves immediately off the shared cache rather than firing a new
    // request, which is what lets the dialog open with the map ready instead
    // of a "Placing today's stops…" flash.
    fetchDayMap(trip.id, columnId)
      .then((data) => {
        if (!cancelled) setDayMap(data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't place these stops on the map.");
      });

    return () => {
      cancelled = true;
    };
  }, [open, trip.id, columnId]);

  const pins = dayMap?.pins ?? null;

  useEffect(() => {
    if (!open || !dayMap || dayMap.pins.length === 0 || !mapEl.current) return;
    let cancelled = false;
    let map: import('leaflet').Map | undefined;

    import('leaflet').then((L) => {
      if (cancelled || !mapEl.current) return;

      // zoomControl: false + a control re-added bottom-right, because that's
      // where every mainstream map product (Google included) puts it — top
      // left is a Leaflet-ism that reads unfamiliar next to a real map.
      map = L.map(mapEl.current, { zoomControl: false });
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // CARTO's free Voyager basemap: light, muted roads and labelled POIs —
      // the closest a keyless tile source gets to Google's own palette. Plain
      // OSM tiles read distinctly more like a wiki map (heavier lines, mustard
      // major roads) than a consumer nav app.
      //
      // CARTO now requires a key or every tile renders with an "API KEY
      // REQUIRED" watermark — free, instant, no approval queue, from
      // https://carto.com/basemaps/apikey. Without one configured yet, this
      // falls back to plain OSM tiles rather than shipping the watermark.
      const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;
      L.tileLayer(
        cartoKey
          ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: cartoKey
            ? '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
            : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          subdomains: cartoKey ? 'abcd' : 'abc',
          maxZoom: cartoKey ? 20 : 19,
        },
      ).addTo(map);

      const { pins, route } = dayMap;

      // The real, road-following line when OSRM's free router came through;
      // otherwise a dashed straight line between pins so the day's order is
      // still readable — dashed specifically so it never reads as a route
      // someone could actually walk.
      if (route && route.length > 1) {
        L.polyline(route, { color: ROUTE_COLOR, weight: 4, opacity: 0.85 }).addTo(map);
      } else if (pins.length > 1) {
        L.polyline(
          pins.map((pin) => [pin.lat, pin.lng]),
          { color: ROUTE_COLOR, weight: 3, opacity: 0.6, dashArray: '2 10' },
        ).addTo(map);
      }

      pins.forEach((pin, index) => {
        L.marker([pin.lat, pin.lng], { icon: pinIcon(L, index) })
          .addTo(map!)
          .bindPopup(
            `<strong>${index + 1}. ${escapeHtml(pin.title)}</strong>` +
              (pin.time ? `<span class="triply-leaflet-popup-time">${escapeHtml(pin.time)}</span>` : '') +
              (pin.mapsUrl
                ? `<a href="${pin.mapsUrl}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>`
                : ''),
            { className: 'triply-leaflet-popup' },
          );
      });

      // Fit to the route's own extent when there is one — it can bulge
      // outside the straight line between pins (a path around a park, say) —
      // and to the pins alone otherwise.
      const boundsSource: [number, number][] =
        route && route.length > 1 ? route : pins.map((pin) => [pin.lat, pin.lng]);
      map.fitBounds(L.latLngBounds(boundsSource), { padding: [32, 32], maxZoom: 15 });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [open, dayMap]);

  if (!column) return null;

  const showMap = !error && pins && pins.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${column.title} on the map`}
      description="Tap a pin for that stop, or open the whole day's route in Google Maps."
      width="lg"
    >
      {error && <p className="text-[13px] text-danger">{error}</p>}

      {!error && pins === null && (
        <p className="text-[13px] text-muted">Placing today&apos;s stops…</p>
      )}

      {!error && pins?.length === 0 && (
        <p className="text-[13px] text-muted">
          Nothing to show yet — add a stop to a card to see it here.
        </p>
      )}

      <div className="relative" style={{ display: showMap ? 'block' : 'none' }}>
        <div
          ref={mapEl}
          className="triply-leaflet h-[420px] w-full overflow-hidden rounded-lg border border-line"
        />

        {dayMap?.routeUrl && (
          <a
            href={dayMap.routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'absolute top-3 right-3 z-[1000] inline-flex items-center gap-1.5 rounded-full',
              'border border-line bg-card px-3 py-2 text-[12.5px] font-semibold text-ink shadow-float',
              'transition-colors duration-150 ease-out hover:border-brand hover:bg-brand-soft hover:text-brand-on-soft',
            )}
          >
            <Navigation size={13} />
            Open in Google Maps
          </a>
        )}
      </div>
    </Dialog>
  );
}
