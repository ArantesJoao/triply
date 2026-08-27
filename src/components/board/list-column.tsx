'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  BacklogIllustration,
  BacklogTagHint,
  EmptyState,
} from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { BACKLOG_KEY } from '@/lib/board-model';

import { ColumnHeader } from './column-header';
import {
  AXIS_GUTTER_PX,
  AXIS_TOP_GAP_PX,
  COLUMN_HEADER_PX,
  minutesToPx,
} from './geometry';
import { PlanCard } from './plan-card';
import { useColumn, useColumnItems } from './store';

/**
 * A plain ordered stack — Backlog, and any other list the user adds. No axis;
 * drop position determines order.
 */
export function ListColumn({
  columnId,
  width,
  tagFilters = [],
  onOpenItem,
  onAddItem,
}: {
  columnId: string;
  width: number | string;
  tagFilters?: string[];
  onOpenItem: (itemId: string) => void;
  onAddItem: (columnId: string) => void;
}) {
  const column = useColumn(columnId);
  const items = useColumnItems(columnId);

  const { setNodeRef, isOver } = useDroppable({
    id: `list:${columnId}`,
    data: { type: 'list', columnId },
  });

  if (!column) return null;

  const isBacklog = column.key === BACKLOG_KEY;

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

      <div
        ref={setNodeRef}
        // Height comes from the content, not from the axis. A list of four
        // ideas is four cards tall; stretching it to match the day columns
        // just draws a long empty box and says nothing. The top gap is the
        // days' gap, so this box starts level with their first hour.
        style={{ marginTop: AXIS_TOP_GAP_PX }}
        className={cn(
          'scroll-slim flex flex-col gap-2 overflow-y-auto rounded-xl border p-2 transition-colors duration-150',
          isOver ? 'border-brand bg-brand-soft/40' : 'border-line bg-card',
        )}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.length === 0 ? (
            <EmptyState
              size="sm"
              // Top-aligned, not centred: in a full-height column centring
              // pushes the illustration and CTA below the fold on a laptop.
              className="mx-auto"
              illustration={
                isBacklog ? <BacklogIllustration className="w-32" /> : undefined
              }
              title={
                isBacklog ? 'Your backlog is empty' : `${column.title} is empty`
              }
              body={
                isBacklog
                  ? "Save ideas as you browse so you're ready to build the plan."
                  : 'Drop cards here, or add one.'
              }
              // Only the Backlog gets the examples: it is the one column whose
              // job has to be explained before anything is in it.
              hint={isBacklog ? <BacklogTagHint /> : undefined}
              action={
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onAddItem(columnId)}
                >
                  <Plus size={15} />
                  {isBacklog ? 'Save your first idea' : 'Add an item'}
                </Button>
              }
            />
          ) : (
            items.map((item) => (
              <PlanCard
                key={item.id}
                itemId={item.id}
                variant="list"
                onOpen={onOpenItem}
                dimmed={
                  tagFilters.length > 0 &&
                  !tagFilters.some((t) => item.tags.includes(t))
                }
              />
            ))
          )}
        </SortableContext>
      </div>

      {items.length > 0 && (
        <button
          type="button"
          onClick={() => onAddItem(columnId)}
          className="mt-1.5 flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line-strong text-[12px] text-muted transition-colors hover:border-brand hover:text-brand"
        >
          <Plus size={14} />
          Add item
        </button>
      )}
    </section>
  );
}

/** The left gutter of hour labels, shared by every timed column. */
export function AxisGutter({
  axis,
  height,
}: {
  axis: { start: number; end: number };
  height: number;
}) {
  const ticks: number[] = [];
  for (let at = Math.ceil(axis.start / 60) * 60; at <= axis.end; at += 60) {
    ticks.push(at);
  }

  return (
    <div
      className="sticky left-0 z-20 shrink-0 bg-page/95 backdrop-blur-sm"
      style={{ width: AXIS_GUTTER_PX }}
    >
      {/* The sticky cover is the header's height and no more. It used to run
          all the way down to the axis origin, which is exactly where the first
          hour label is centred — so "04:00" was permanently half-swallowed by
          it. Ending it level with the column headers gives that label its top
          half back, and labels scrolling up still vanish on the same line the
          headers' bottom edge sits on. */}
      <div
        className="sticky top-0 z-10 bg-page/95"
        style={{ height: COLUMN_HEADER_PX }}
      />

      {/* The gap moves here, so the origin still lands at
          COLUMN_HEADER_PX + AXIS_TOP_GAP_PX — level with every column. */}
      <div className="relative" style={{ height, marginTop: AXIS_TOP_GAP_PX }}>
        {ticks.map((at) => {
          const past = at >= 24 * 60;
          const hour = Math.floor((at % (24 * 60)) / 60);
          return (
            <div
              key={at}
              style={{ top: minutesToPx(at - axis.start) }}
              className="absolute right-2 -translate-y-1/2 font-display text-[10px] font-medium tabular-nums"
            >
              <span className={past ? 'text-brand' : 'text-faint'}>
                {String(hour).padStart(2, '0')}:00
                {/* Past midnight the bare clock face is ambiguous. */}
                {past && <span className="ml-0.5">⁺¹</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
