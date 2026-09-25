import type { MetadataRoute } from 'next';

/**
 * Makes trip.ly installable ("Add to Home Screen"). Served at
 * /manifest.webmanifest and linked from every page by the file convention.
 *
 * The icons follow the same rule as every other icon this origin hands out
 * (see the note in `src/app/api/mcp/route.ts`): full-bleed opaque squares, so
 * a launcher's own rounding has no transparent corner to halo. The maskable
 * pair keeps the mark inside the 80% safe zone for Android's adaptive shapes.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'trip.ly',
    short_name: 'trip.ly',
    description:
      'A shared trip-planning board. Collect ideas, schedule days, and figure it out together.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // The light page colour; the splash and toolbar settle on the in-app
    // theme via `theme-color` as soon as the page paints.
    background_color: '#FAFAF8',
    theme_color: '#FAFAF8',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
