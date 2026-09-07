'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { INSTANT_MINUTES, packLanes, type LanePlacement } from '@/lib/layout';
import { formatAxisLabel, toAxisMinutes } from '@/lib/time';

import { ColumnHeader } from './column-header';
import {
  AXIS_TOP_GAP_PX,
  CARD_COMPACT_PX,
  CARD_FULL_PX,
  CARD_GAP_PX,
  EMPTY_PROMPT_PX,
  densityFor,
  minutesToPx,
} from './geometry';
import { PlanCard } from './plan-card';
import { useColumn, useColumnItems } from './store';

export type AxisWindow = { start: number; end: number };

/**
 * Do two placements share any horizontal space?
 *
 * Cards in different lanes of the same collision cluster sit beside each
 * other, so a later one puts no ceiling on how tall an earlier one may be.
 * Cards that do share width — the usual case, both full width — do.
 */
const sharesWidth = (a: LanePlacement, b: LanePlacement) =>
  a.lane / a.lanes < (b.lane + 1) / b.lanes &&
  b.lane / b.lanes < (a.lane + 1) / a.lanes;

export function TimedColumn({
  columnId,
  axis,
  width,
  dropHint,
  closesGrid = false,
  tagFilters = [],
  onOpenItem,
  onAddItem,
}: {
  columnId: string;
  axis: AxisWindow;
  width: number | string;
  /** Live drop preview, when a card is being dragged over this column's axis. */
  dropHint: number | null;
  /** Last day on the board — draws the rule that closes the grid off. */
  closesGrid?: boolean;
  tagFilters?: string[];
  onOpenItem: (itemId: string) => void;
  onAddItem: (columnId: string, time?: string | null) => void;
}) {
  const column = useColumn(columnId);
  const items = useColumnItems(columnId);

  const scheduled = useMemo(() => items.filter((item) => item.time), [items]);

  const placements = useMemo(() => {
    const starts = new Map(
      scheduled.map((item) => [
        item.id,
        toAxisMinutes(item.time, item.dayOffset) ?? axis.start,
      ]),
    );

    // Lanes first, from real time only — an activity declares its own duration
    // and not one pixel more. See the rule at the top of `@/lib/layout`.
    const packed = packLanes(
      scheduled.map((item) => {
        const start = starts.get(item.id)!;
        return {
          id: item.id,
          start,
          end: start + Math.max(item.durationMin ?? 0, INSTANT_MINUTES),
        };
      }),
    );

    // Heights second. A card gets the room its time earns it, and picks a
    // density that fits in that room — it is never sized to its content, so
    // its content can never spill out of it.
    return packed.map((placement) => {
      const item = scheduled.find((s) => s.id === placement.id)!;

      let nextStart = Infinity;
      for (const other of packed) {
        if (other.start <= placement.start || !sharesWidth(placement, other)) {
          continue;
        }
        nextStart = Math.min(nextStart, other.start);
      }
      const roomPx =
        nextStart === Infinity
          ? Infinity
          : minutesToPx(nextStart - placement.start) - CARD_GAP_PX;

      const duration = item.durationMin ?? 0;
      const height = Math.max(
        CARD_COMPACT_PX,
        duration > 0
          ? // A real duration is the card's true height; nothing that shares
            // its width can start before it ends, so this always fits.
            minutesToPx(duration) - CARD_GAP_PX
          : // With no duration the card claims no span of its own, so it fills
            // whatever is free — and hugs its content when nothing follows.
            (roomPx === Infinity ? CARD_FULL_PX : roomPx),
      );

      return { ...placement, item, height, density: densityFor(height) };
    });
  }, [scheduled, axis.start]);

  const { setNodeRef: setAxisRef, isOver: axisOver } = useDroppable({
    id: `axis:${columnId}`,
    data: { type: 'axis', columnId },
  });

  if (!column) return null;

  const axisHeight = minutesToPx(axis.end - axis.start);

  return (
    <section
      className="flex shrink-0 flex-col"
      style={{ width }}
      aria-label={column.title}
    >
      <ColumnHeader
        columnId={columnId}
        count={items.length}
        onAddItem={() => onAddItem(columnId)}
      />

      {/* The axis. Same height and same origin in every timed column. */}
      <div
        ref={setAxisRef}
        data-axis-column={columnId}
        style={{ height: axisHeight, marginTop: AXIS_TOP_GAP_PX }}
        className={cn(
          'relative border-l transition-colors duration-150',
          // Every day is bounded on the left by its own rule and on the right
          // by the next day's. The last one has no next day, so it draws its
          // own closing edge — otherwise the grid just frays out.
          closesGrid && 'border-r',
          axisOver ? 'border-brand bg-brand-soft/30' : 'border-line',
        )}
      >
        <AxisGridLines axis={axis} />

        {placements.length === 0 && !axisOver && (
          <EmptyAxisPrompt onAdd={() => onAddItem(columnId)} />
        )}

        {dropHint != null && <DropIndicator axis={axis} minutes={dropHint} />}

        <SortableContext
          items={scheduled.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {placements.map((placement) => {
            const { lanes, lane, item, height, density } = placement;
            const dimByFilter =
              tagFilters.length > 0 &&
              !tagFilters.some((t) => item.tags.includes(t));

            return (
              <PlanCard
                key={placement.id}
                itemId={placement.id}
                variant="axis"
                density={density}
                onOpen={onOpenItem}
                dimmed={dimByFilter}
                style={{
                  top: minutesToPx(placement.start - axis.start),
                  height,
                  left: `calc(${(lane * 100) / lanes}% + 6px)`,
                  width: `calc(${100 / lanes}% - 10px)`,
                }}
              />
            );
          })}
        </SortableContext>
      </div>
    </section>
  );
}

/**
 * Hour rules. Drawn per column, but each one bleeds left across the board's
 * 12px inter-column gap (`gap-3` in board-canvas) so the rules read as one
 * continuous line for the whole city rather than stopping short at every
 * column edge. Bleeding left rather than right means the last timed column
 * doesn't poke a stub of rule at the list column beside it.
 */
function AxisGridLines({ axis }: { axis: AxisWindow }) {
  const lines = useMemo(() => {
    const result: { at: number; major: boolean }[] = [];
    for (let at = axis.start; at <= axis.end; at += 30) {
      result.push({ at, major: at % 60 === 0 });
    }
    return result;
  }, [axis.start, axis.end]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {lines.map(({ at, major }) => (
        <div
          key={at}
          style={{ top: minutesToPx(at - axis.start) }}
          className={cn(
            'absolute -left-3 right-0 h-px',
            major ? 'bg-line' : 'bg-line/50',
          )}
        />
      ))}
    </div>
  );
}

/** Shows where a dragged card would land, and at what time. */
function DropIndicator({
  axis,
  minutes,
}: {
  axis: AxisWindow;
  minutes: number;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-1 z-20"
      style={{ top: minutesToPx(minutes - axis.start) }}
    >
      <div className="relative h-0.5 rounded-full bg-brand">
        <span className="absolute -top-2.5 left-0 rounded-full bg-brand px-1.5 py-0.5 font-display text-[10px] font-semibold text-brand-contrast tabular-nums">
          {formatAxisLabel(minutes)}
        </span>
      </div>
    </div>
  );
}

/**
 * The axis stays visible when a day is empty — the point is to teach how
 * time-based scheduling works, not to hide the tool.
 */
function EmptyAxisPrompt({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      // The desktop height comes from geometry rather than a literal here, so
      // it stays tied to the Backlog's empty state. Phones keep the viewport
      // measure — there the day is the only thing on screen.
      className={cn(
        // Inset equally on all three sides it touches — same step as inset-x.
        'absolute inset-x-2 top-2 p-10 flex items-center justify-center rounded-xl',
        'border border-dashed border-line-strong backdrop-blur-[1px]',
        'min-h-[calc(100vh-120px)] md:min-h-[var(--empty-prompt)]',
      )}
      style={{
        backgroundColor: '#FAFAFE',
        '--empty-prompt': `${EMPTY_PROMPT_PX}px`,
      } as React.CSSProperties}
    >
      <EmptyState
        size="sm"
        title="No timed plans yet"
        body="Drag an idea here, or add one to get started."
        action={
          <button
            type="button"
            onClick={onAdd}
            className="mt-1 inline-grid size-9 place-items-center rounded-full bg-brand text-brand-contrast transition-colors hover:bg-brand-hover"
            aria-label="Add the first plan for this day"
          >
            <Plus size={17} />
          </button>
        }
      />
    </div>
  );
}
