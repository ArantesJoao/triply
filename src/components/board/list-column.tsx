'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BacklogIllustration, EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { BACKLOG_KEY } from '@/server/board';

import { ColumnHeader } from './column-header';
import { COLUMN_HEADER_PX, TRAY_PX, minutesToPx } from './geometry';
import { PlanCard } from './plan-card';
import { useColumn, useColumnItems } from './store';

/**
 * A plain ordered stack — Backlog, and any other list the user adds. No axis;
 * drop position determines order.
 */
export function ListColumn({
  columnId,
  width,
  /** Height of the timed axis, so lists line up with the day columns. */
  bodyHeight,
  onOpenItem,
  onAddItem,
}: {
  columnId: string;
  width: number | string;
  bodyHeight: number | null;
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
        // Matches the timed columns' tray + axis, so the tops and bottoms align.
        style={
          bodyHeight
            ? { height: bodyHeight + TRAY_PX + 8 }
            : { minHeight: 240 }
        }
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
              className="m-auto"
              illustration={
                isBacklog ? (
                  <BacklogIllustration className="text-brand" />
                ) : undefined
              }
              title={
                isBacklog ? 'Your backlog is empty' : `${column.title} is empty`
              }
              body={
                isBacklog
                  ? "Save ideas as you browse so you're ready to build the plan."
                  : 'Drop cards here, or add one.'
              }
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
    <div className="sticky left-0 z-20 shrink-0 bg-page/95 backdrop-blur-sm">
      {/* Spacers matching the column header and tray exactly, so the first
          hour label lines up with the top of every column's axis. */}
      <div style={{ height: COLUMN_HEADER_PX }} />
      <div style={{ height: TRAY_PX + 8 }} />

      <div className="relative" style={{ height }}>
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
