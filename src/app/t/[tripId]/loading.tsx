import { FileJson, Plus, Share2 } from 'lucide-react';
import Link from 'next/link';

import {
  AXIS_GUTTER_PX,
  COLUMN_HEADER_PX,
  LIST_COLUMN_PX,
  TIMED_COLUMN_PX,
  minutesToPx,
} from '@/components/board/geometry';
import { Logo } from '@/components/brand/route-mark';
import { ThemeToggle } from '@/components/theme';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { DEFAULT_AXIS_END, DEFAULT_AXIS_START } from '@/lib/time';

/**
 * Instant shell for the board page.
 *
 * Mirrors the real layout — header, cue strip, then the axis gutter and columns
 * — so nothing shifts when the real board mounts. Every dimension here comes
 * from the same constants the board itself renders against: geometry.ts for the
 * column widths and the 192px/hour scale, time.ts for the default 04:00–26:00
 * axis window. The column rail below the cue strip is the mobile-only bar the
 * board shows under 1024px, which is also where the board drops to one column.
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

        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-36 max-w-full" />
        </div>

        <Button size="sm" disabled className="hidden sm:inline-flex">
          <FileJson size={15} />
          Import
        </Button>

        <Button size="sm" variant="primary" disabled>
          <Share2 size={15} />
          <span className="hidden sm:inline">Share</span>
        </Button>

        <ThemeToggle className="hidden md:inline-flex" />

        <Skeleton className="size-9 shrink-0 rounded-full" />
      </header>

      {/* ── Cue strip ── */}
      <div className="shrink-0 border-b border-line bg-card">
        <div className="flex items-center gap-2 overflow-hidden px-4 py-2">
          {/* City tabs */}
          {[132, 96, 116].map((width, i) => (
            <Skeleton
              key={i}
              className="h-11 shrink-0 rounded-xl"
              style={{ width }}
            />
          ))}

          <span className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3.5 text-[13px] text-muted opacity-50">
            <Plus size={16} />
            City
          </span>

          <span className="flex-1" />

          {/* Filter toggle */}
          <Skeleton className="h-9 w-24 shrink-0 rounded-[10px]" />

          {/* Add to Trip */}
          <Skeleton className="h-11 w-32 shrink-0 rounded-xl" />
        </div>
      </div>

      {/* ── Column rail (mobile only, like the board) ── */}
      <div className="flex shrink-0 items-center gap-1.5 overflow-hidden border-b border-line bg-card px-3 py-2 lg:hidden">
        {[92, 84, 88, 76].map((width, i) => (
          <Skeleton
            key={i}
            className="h-9 shrink-0 rounded-full"
            style={{ width }}
          />
        ))}
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-muted opacity-50">
          <Plus size={16} />
        </span>
      </div>

      {/* ── Canvas ── */}
      <div className="scroll-slim relative flex-1 overflow-auto">
        <div className="flex items-start gap-3 px-4 pt-3 pb-12 lg:w-max">
          <AxisGutterSkeleton />

          {/* Under 1024px the board shows a single, fluid timed column. */}
          <TimedColumnSkeleton
            className="flex lg:hidden"
            width={`calc(100vw - ${AXIS_GUTTER_PX + 44}px)`}
            cards={COLUMN_CARDS[0]}
          />

          {COLUMN_CARDS.map((cards, i) => (
            <TimedColumnSkeleton
              key={i}
              className="hidden lg:flex"
              width={TIMED_COLUMN_PX}
              cards={cards}
            />
          ))}

          <ListColumnSkeleton className="hidden lg:flex" />

          <span
            style={{ width: 168 }}
            className="mt-[42px] hidden h-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-[12px] text-muted opacity-50 lg:flex"
          >
            <Plus size={17} />
            Add day / list
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Axis geometry — the same window the board falls back to before any
 * item pushes it wider.
 * ------------------------------------------------------------------ */

const AXIS_START = DEFAULT_AXIS_START;
const AXIS_HEIGHT = minutesToPx(DEFAULT_AXIS_END - DEFAULT_AXIS_START);

/** Whole hours across the default window, as AxisGutter draws them. */
const HOUR_TICKS = Array.from(
  { length: Math.floor((DEFAULT_AXIS_END - AXIS_START) / 60) + 1 },
  (_, i) => AXIS_START + i * 60,
);

/** Left gutter of hour labels. Sticky and 52px wide, exactly like the real one. */
function AxisGutterSkeleton() {
  return (
    <div
      className="sticky left-0 z-20 shrink-0 bg-page/95 backdrop-blur-sm"
      style={{ width: AXIS_GUTTER_PX }}
    >
      {/* Spacer matching the column header + its mt-2 gap. */}
      <div
        className="sticky top-0 z-10 bg-page/95"
        style={{ height: COLUMN_HEADER_PX + 8 }}
      />

      <div className="relative" style={{ height: AXIS_HEIGHT }}>
        {HOUR_TICKS.map((at) => (
          <Skeleton
            key={at}
            className="absolute right-2 h-2.5 w-7 -translate-y-1/2 rounded-sm"
            style={{ top: minutesToPx(at - AXIS_START) }}
          />
        ))}
      </div>
    </div>
  );
}

/** A day column: fixed-height header, then the axis with its cards. */
function TimedColumnSkeleton({
  className,
  width,
  cards,
}: {
  className?: string;
  width: number | string;
  cards: AxisCard[];
}) {
  return (
    <section className={cn('shrink-0 flex-col', className)} style={{ width }}>
      <ColumnHeaderSkeleton timed />

      <div
        className="relative mt-2 border-l border-line"
        style={{ height: AXIS_HEIGHT }}
      >
        <GridLines />

        {cards.map((card) => (
          <div
            key={card.at}
            style={{
              top: minutesToPx(card.at - AXIS_START),
              height: card.tall ? TALL_CARD_PX : SHORT_CARD_PX,
              left: 6,
              right: 4,
            }}
            className="absolute overflow-hidden border border-line bg-card rounded-lg border-l-[3px] border-l-brand shadow-card"
          >
            <AxisCardSkeleton tall={card.tall} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Backlog and any other plain list. Body height tracks the axis, as it does live. */
function ListColumnSkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn('shrink-0 flex-col', className)}
      style={{ width: LIST_COLUMN_PX }}
    >
      <ColumnHeaderSkeleton />

      <div
        style={{ height: AXIS_HEIGHT }}
        className="flex flex-col gap-2 overflow-hidden rounded-xl border border-line bg-card p-2"
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-line bg-card">
            <div className="flex gap-1.5 px-2.5 py-2">
              <GripSlot />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-32 max-w-full rounded-sm" />
                <Skeleton className="mt-1 h-3 w-full rounded-sm" />
                <Skeleton className="mt-1 h-3 w-3/5 rounded-sm" />
                <div className="mt-1.5 flex gap-1">
                  <Skeleton className="h-[22px] w-12 rounded-lg" />
                  <Skeleton className="h-[22px] w-14 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <span className="mt-1.5 flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line-strong text-[12px] text-muted opacity-50">
        <Plus size={14} />
        Add item
      </span>
    </section>
  );
}

/** Dot, title, count, and the two icon buttons — at the fixed header height. */
function ColumnHeaderSkeleton({ timed = false }: { timed?: boolean }) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-1.5 bg-page px-0.5"
      style={{ height: COLUMN_HEADER_PX }}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          timed ? 'bg-brand' : 'bg-line-strong',
        )}
      />
      <Skeleton className="h-4 w-24" />
      <div className="min-w-0 flex-1" />
      <Skeleton className="h-2.5 w-2.5 rounded-sm" />
      <Skeleton className="size-7 shrink-0 rounded-[10px]" />
      <Skeleton className="size-7 shrink-0 rounded-[10px]" />
    </header>
  );
}

/** Half-hour rules, majors on the hour — the board draws these per column. */
function GridLines() {
  const lines: number[] = [];
  for (let at = AXIS_START; at <= DEFAULT_AXIS_END; at += 30) lines.push(at);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {lines.map((at) => (
        <div
          key={at}
          style={{ top: minutesToPx(at - AXIS_START) }}
          className={cn(
            'absolute inset-x-0 h-px',
            at % 60 === 0 ? 'bg-line' : 'bg-line/50',
          )}
        />
      ))}
    </div>
  );
}

/** Placeholder innards of a timed card: grip, time, title, and tags. */
function AxisCardSkeleton({ tall }: { tall: boolean }) {
  return (
    <div className="flex gap-1.5 px-2.5 py-2">
      <GripSlot />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-2.5 w-8 rounded-sm" />
        <Skeleton className="mt-1 h-3.5 w-28 max-w-full rounded-sm" />
        {tall && (
          <div className="mt-1.5 flex gap-1">
            <Skeleton className="h-[22px] w-12 rounded-lg" />
            <Skeleton className="h-[22px] w-10 rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
}

/** The 20px drag handle every card reserves on its left edge. */
function GripSlot() {
  return (
    <div className="-ml-1 flex w-5 shrink-0 justify-center">
      <Skeleton className="mt-px h-3.5 w-1.5 rounded-sm" />
    </div>
  );
}

type AxisCard = { at: number; tall: boolean };

/** Card height in px, for the two shapes a card takes: with tags, and without. */
const TALL_CARD_PX = 78;
const SHORT_CARD_PX = 50;

/** Minutes from the column's own midnight — the axis's own unit. */
const clock = (hours: number, minutes = 0) => hours * 60 + minutes;

/**
 * Plausible times per column, so the skeleton reads as a real day rather than a
 * uniform grid. Nothing overlaps, which is also true of most real columns.
 */
const COLUMN_CARDS: AxisCard[][] = [
  [
    { at: clock(6, 30), tall: true },
    { at: clock(9), tall: false },
    { at: clock(10, 30), tall: true },
    { at: clock(13), tall: false },
    { at: clock(15, 30), tall: true },
    { at: clock(19), tall: true },
  ],
  [
    { at: clock(7), tall: false },
    { at: clock(9, 30), tall: true },
    { at: clock(12), tall: true },
    { at: clock(14, 30), tall: false },
    { at: clock(18), tall: true },
  ],
  [
    { at: clock(6), tall: true },
    { at: clock(8, 30), tall: false },
    { at: clock(11), tall: true },
    { at: clock(13, 30), tall: true },
    { at: clock(17), tall: false },
    { at: clock(20, 30), tall: true },
  ],
];
