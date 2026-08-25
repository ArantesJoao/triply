import { Plus, Share2 } from 'lucide-react';
import Link from 'next/link';

import { Logo } from '@/components/brand/route-mark';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Instant shell for the board page.
 *
 * Mirrors the real layout precisely — header, city tabs, then columns with
 * card-shaped placeholders — so nothing shifts when the real board mounts.
 * Dimensions match geometry.ts: columns are 264px, gutter 52px, header 42px,
 * tray 88px.
 *
 * On mobile (<1024px, the same breakpoint `board-canvas` uses), only one
 * column shows — matching the real board's compact mode. On desktop, the full
 * multi-column layout appears.
 */
export default function BoardLoading() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page">
      {/* ── Board header ── */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-card px-4 py-2.5">
        <Link href="/" aria-label="All trips" className="shrink-0">
          <Logo size="sm" />
        </Link>
        <span className="h-5 w-px shrink-0 bg-line" aria-hidden="true" />
        <Skeleton className="h-5 w-36" />
        <div className="flex-1" />
        <Skeleton className="hidden h-9 w-24 rounded-[10px] sm:block" />
        <Button size="sm" variant="primary" disabled>
          <Share2 size={15} />
          <span className="hidden sm:inline">Share</span>
        </Button>
        <Skeleton className="size-9 rounded-full" />
      </header>

      {/* ── Mobile column rail (< lg) ── */}
      <div className="scroll-none flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-card px-3 py-2 lg:hidden">
        {[72, 64, 80, 56].map((w, i) => (
          <Skeleton
            key={i}
            className="h-9 shrink-0 rounded-full"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* ── Desktop city tabs (≥ lg) ── */}
      <div className="hidden scroll-none items-center gap-2 overflow-x-auto border-b border-line bg-card px-4 py-2 lg:flex">
        {[80, 96, 72].map((w, i) => (
          <Skeleton
            key={i}
            className="h-11 shrink-0 rounded-xl"
            style={{ width: w }}
          />
        ))}
        <button
          type="button"
          disabled
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3.5 text-[13px] text-muted opacity-50"
        >
          <Plus size={16} />
          City
        </button>
      </div>

      {/* ── Canvas ── */}
      <div className="scroll-slim relative flex-1 overflow-auto">
        {/* ── Mobile: single column, fluid width ── */}
        <div className="flex items-start gap-3 px-4 pt-3 pb-12 lg:hidden">
          {/* Axis gutter */}
          <div className="flex shrink-0 flex-col pt-[130px]" style={{ width: 52 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} style={{ height: 128 }} className="relative">
                <Skeleton className="absolute top-0 right-0 h-3 w-8" />
              </div>
            ))}
          </div>

          {/* Single timed column, fluid */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 px-2" style={{ height: 42 }}>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div
              className="rounded-xl border border-line bg-card p-2"
              style={{ height: 88 }}
            >
              <Skeleton className="h-full w-full rounded-[10px]" />
            </div>
            <div className="relative mt-1" style={{ height: 520 }}>
              {COLUMN_CARDS[0].map((card, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 rounded-lg border border-line bg-card shadow-card"
                  style={{ top: card.top, height: card.height }}
                >
                  <CardSkeleton />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Desktop: multi-column, fixed widths ── */}
        <div className="hidden w-max items-start gap-3 px-4 pt-3 pb-12 lg:flex">
          {/* Axis gutter */}
          <div className="flex shrink-0 flex-col pt-[130px]" style={{ width: 52 }}>
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} style={{ height: 128 }} className="relative">
                <Skeleton className="absolute top-0 right-0 h-3 w-8" />
              </div>
            ))}
          </div>

          {/* Timed columns */}
          {[0, 1, 2].map((col) => (
            <div key={col} className="shrink-0" style={{ width: 264 }}>
              <div
                className="flex items-center gap-2 px-2"
                style={{ height: 42 }}
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
              <div
                className="rounded-xl border border-line bg-card p-2"
                style={{ height: 88 }}
              >
                <Skeleton className="h-full w-full rounded-[10px]" />
              </div>
              <div className="relative mt-1" style={{ height: 640 }}>
                {COLUMN_CARDS[col].map((card, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 rounded-lg border border-line bg-card shadow-card"
                    style={{ top: card.top, height: card.height }}
                  >
                    <CardSkeleton />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* List column */}
          <div className="shrink-0" style={{ width: 280 }}>
            <div
              className="flex items-center gap-2 px-2"
              style={{ height: 42 }}
            >
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-6" />
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-card p-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-line bg-card p-2.5"
                >
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-1 h-3 w-3/4" />
                  <div className="mt-2 flex gap-1">
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Placeholder innards of a timed card. */
function CardSkeleton() {
  return (
    <div className="flex gap-1.5 px-2.5 py-2">
      <Skeleton className="mt-0.5 h-3 w-3 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-2.5 w-12 rounded-sm" />
        <Skeleton className="mt-1.5 h-3.5 w-28 max-w-full rounded-sm" />
        <div className="mt-2 flex gap-1">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Staggered card positions per column so the skeleton reads as a real board
 * rather than a uniform grid. Heights and offsets are eyeballed to cover
 * common itinerary density (a few stops per day, some overlap).
 */
const COLUMN_CARDS: { top: number; height: number }[][] = [
  [
    { top: 20, height: 76 },
    { top: 140, height: 64 },
    { top: 290, height: 76 },
    { top: 420, height: 64 },
  ],
  [
    { top: 60, height: 64 },
    { top: 180, height: 76 },
    { top: 340, height: 64 },
  ],
  [
    { top: 10, height: 76 },
    { top: 160, height: 64 },
    { top: 300, height: 76 },
    { top: 440, height: 64 },
    { top: 560, height: 76 },
  ],
];
