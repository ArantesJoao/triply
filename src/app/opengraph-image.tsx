import { ImageResponse } from 'next/og';

import { RouteMark } from '@/components/brand/route-mark';

export const alt = 'trip.ly — a shared trip-planning board';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// No dynamic params here, so Next.js renders this once at build time and
// serves it as a static asset — same deal as `icon.svg`, just for link
// previews (WhatsApp, iMessage, Slack, X, ...) instead of the browser tab.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 32,
          padding: '0 100px',
          background: '#0F1230',
        }}
      >
        {/* `tone="brand"` reads a CSS custom property that doesn't exist in
            Satori's isolated render — `currentColor` off an explicit `color`
            is the only way to tint it in here. */}
        <div style={{ display: 'flex', color: '#7B7EF7' }}>
          <RouteMark width={240} tone="current" />
        </div>
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, letterSpacing: '-2px' }}>
          <span style={{ display: 'flex', color: '#F8F8FB' }}>trip</span>
          <span style={{ display: 'flex', color: '#7B7EF7' }}>.ly</span>
        </div>
        <div
          style={{
            display: 'flex',
            maxWidth: 840,
            fontSize: 34,
            lineHeight: 1.4,
            color: '#B8BCD0',
          }}
        >
          A shared trip-planning board. Collect ideas, schedule days, and
          figure it out together.
        </div>
      </div>
    ),
    { ...size },
  );
}
