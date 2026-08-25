'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { packLanes } from '@/lib/layout';
import { formatAxisLabel, toAxisMinutes } from '@/lib/time';

import { ColumnHeader } from './column-header';
import {
  CARD_GAP_PX,
  PX_PER_MINUTE,
  TRAY_PX,
  minutesToPx,
} from './geometry';
import { PlanCard } from './plan-card';
import { useColumn, useColumnItems } from './store';

export type AxisWindow = { start: number; end: number };

/** Smallest slot a card may occupy, so a bare title still has room to breathe. */
const MIN_SLOT_PX = 46;

export function TimedColumn({
  columnId,
  axis,
  width,
  dropHint,
  onOpenItem,
  onAddItem,
}: {
  columnId: string;
  axis: AxisWindow;
  width: number | string;
  /** Live drop preview, when a card is being dragged over this column's axis. */
  dropHint: number | null;
  onOpenItem: (itemId: string) => void;
  onAddItem: (columnId: string, time?: string | null) => void;
}) {
  const column = useColumn(columnId);
  const items = useColumnItems(columnId);

  /**
   * Measured minimum span, in minutes, per card. Only ever grows within a
   * layout pass — a card that needs more room pushes its own slot open, and
   * because growth is monotone the pack/measure cycle always settles instead of
   * oscillating between one and two lanes.
   */
  const [measured, setMeasured] = useState<Record<string, number>>({});

  const reportHeight = useCallback((itemId: string, height: number) => {
    const minutes = Math.ceil((height + CARD_GAP_PX) / PX_PER_MINUTE);
    setMeasured((current) =>
      (current[itemId] ?? 0) >= minutes
        ? current
        : { ...current, [itemId]: minutes },
    );
  }, []);

  const releaseHeight = useCallback((itemId: string) => {
    setMeasured((current) => {
      if (!(itemId in current)) return current;
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const scheduled = useMemo(() => items.filter((item) => item.time), [items]);
  const tray = useMemo(() => items.filter((item) => !item.time), [items]);

  const placements = useMemo(() => {
    const inputs = scheduled.map((item) => {
      const start = toAxisMinutes(item.time, item.dayOffset) ?? axis.start;
      // The span is the larger of the stated duration and what the card
      // actually measured — never a guessed constant.
      const span = Math.max(
        item.durationMin ?? 0,
        measured[item.id] ?? 0,
        MIN_SLOT_PX / PX_PER_MINUTE,
      );
      return { id: item.id, start, end: start + span };
    });
    return packLanes(inputs);
  }, [scheduled, measured, axis.start]);

  const { setNodeRef: setAxisRef, isOver: axisOver } = useDroppable({
    id: `axis:${columnId}`,
    data: { type: 'axis', columnId },
  });

  const { setNodeRef: setTrayRef, isOver: trayOver } = useDroppable({
    id: `tray:${columnId}`,
    data: { type: 'tray', columnId },
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

      {/* Fixed height — this must not grow with its contents, or this column's
          axis would start lower than its neighbours' and the alignment breaks. */}
      <div
        ref={setTrayRef}
        style={{ height: TRAY_PX }}
        className={cn(
          'scroll-slim flex flex-col gap-1.5 overflow-y-auto rounded-xl border border-dashed p-1.5 transition-colors duration-150',
          trayOver
            ? 'border-brand bg-brand-soft'
            : 'border-line-strong bg-subtle',
        )}
      >
        <SortableContext
          items={tray.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {tray.length === 0 ? (
            <p className="m-auto px-2 text-center text-[11px] leading-snug text-faint">
              {trayOver
                ? 'Drop to unschedule'
                : 'No time yet — drop a card here to unschedule it'}
            </p>
          ) : (
            tray.map((item) => (
              <PlanCard
                key={item.id}
                itemId={item.id}
                variant="tray"
                onOpen={onOpenItem}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* The axis itself. Same height and same origin in every timed column. */}
      <div
        ref={setAxisRef}
        data-axis-column={columnId}
        style={{ height: axisHeight }}
        className={cn(
          'relative mt-2 border-l transition-colors duration-150',
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
            // Never fold lane N back onto lane N % cap — that was the
            // prototype's trick and it puts two cards in the same place. The
            // packer's lane count is authoritative; crowded hours get narrow
            // cards rather than overlapping ones.
            const { lanes, lane } = placement;

            return (
              <PlanCard
                key={placement.id}
                itemId={placement.id}
                variant="axis"
                onOpen={onOpenItem}
                onMeasure={reportHeight}
                onContentChange={releaseHeight}
                style={{
                  top: minutesToPx(placement.start - axis.start),
                  height: Math.max(
                    MIN_SLOT_PX,
                    minutesToPx(placement.end - placement.start) - CARD_GAP_PX,
                  ),
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

/** Hour rules. Drawn per column so they read as that column's own grid. */
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
            'absolute inset-x-0 h-px',
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
    <div className="absolute inset-x-2 top-8 rounded-xl border border-dashed border-line-strong bg-card/60 backdrop-blur-[1px]">
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
