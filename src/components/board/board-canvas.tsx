'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CityIllustration, EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { axisRangeFor, fromAxisMinutes, snapMinutes } from '@/lib/time';

import { AddColumnDialog } from './add-column-dialog';
import {
  AXIS_GUTTER_PX,
  LIST_COLUMN_PX,
  TIMED_COLUMN_PX,
  minutesToPx,
  pxToMinutes,
} from './geometry';
import { ItemDialog } from './item-dialog';
import { AxisGutter, ListColumn } from './list-column';
import { CardDragOverlay } from './plan-card';
import { useBoard, useCity, useStore, type ItemRecord } from './store';
import { TimedColumn } from './timed-column';
import { useMediaQuery } from './use-media-query';

type DropTarget =
  | { kind: 'axis'; columnId: string; minutes: number }
  | { kind: 'tray'; columnId: string; index: number }
  | { kind: 'list'; columnId: string; index: number };

export function BoardCanvas({ cityId }: { cityId: string | null }) {
  const store = useStore();
  const city = useCity(cityId);
  const columns = useBoard((state) => state.columns);
  const items = useBoard((state) => state.items);

  const [dragging, setDragging] = useState<ItemRecord | null>(null);
  const [hint, setHint] = useState<{ columnId: string; minutes: number } | null>(
    null,
  );
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [focusColumnId, setFocusColumnId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [autoFocusItemId, setAutoFocusItemId] = useState<string | null>(null);

  const compact = useMediaQuery('(max-width: 1023px)');

  const cityColumns = useMemo(
    () => (city?.columnIds ?? []).map((id) => columns[id]).filter(Boolean),
    [city?.columnIds, columns],
  );

  const timedColumns = useMemo(
    () => cityColumns.filter((column) => column.timed),
    [cityColumns],
  );
  const listColumns = useMemo(
    () => cityColumns.filter((column) => !column.timed),
    [cityColumns],
  );

  /**
   * ONE axis window for the whole city, derived from every scheduled item in
   * it. Because each timed column renders against this same window at the same
   * scale, 19:00 lands at an identical Y in all of them — the single most
   * important behaviour on the board.
   */
  const axis = useMemo(() => {
    const scheduled = cityColumns
      .filter((column) => column.timed)
      .flatMap((column) =>
        column.itemIds
          .map((id) => items[id])
          .filter(Boolean)
          .map((item) => ({
            time: item.time,
            dayOffset: item.dayOffset,
            durationMin: item.durationMin,
          })),
      );
    return axisRangeFor(scheduled);
  }, [cityColumns, items]);

  const axisHeight = minutesToPx(axis.end - axis.start);

  const sensors = useSensors(
    // A small movement threshold keeps taps working as taps.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch waits briefly so a finger drag on the card can still scroll.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /** Turns a dnd-kit drop into a concrete column + time or list position. */
  const resolveDrop = useCallback(
    (event: DragEndEvent | DragMoveEvent): DropTarget | null => {
      const over = event.over;
      if (!over) return null;

      const data = over.data.current as
        | { type?: string; columnId?: string }
        | undefined;

      // Hovering directly over another card: adopt that card's column, and its
      // index for list ordering.
      let type = data?.type;
      const columnId = data?.columnId;
      let index: number | null = null;

      if (type === 'item' && columnId) {
        const column = columns[columnId];
        index = column ? column.itemIds.indexOf(String(over.id)) : null;
        const hovered = items[String(over.id)];
        type = column?.timed ? (hovered?.time ? 'axis' : 'tray') : 'list';
      }

      if (!columnId || !columns[columnId]) return null;
      const column = columns[columnId];

      if (type === 'axis' && column.timed) {
        // Position from the dragged card's top edge against the axis element,
        // so the card lands where its own top is, not where the cursor is.
        const node = document.querySelector(
          `[data-axis-column="${CSS.escape(columnId)}"]`,
        );
        const dragged = event.active.rect.current.translated;
        if (!node || !dragged) return null;

        const bounds = node.getBoundingClientRect();
        const offsetPx = dragged.top - bounds.top;
        const raw = axis.start + pxToMinutes(offsetPx);
        const minutes = Math.min(
          Math.max(snapMinutes(raw), axis.start),
          axis.end - 15,
        );
        return { kind: 'axis', columnId, minutes };
      }

      if (type === 'tray' && column.timed) {
        return { kind: 'tray', columnId, index: index ?? 0 };
      }

      return {
        kind: 'list',
        columnId,
        index: index ?? column.itemIds.length,
      };
    },
    [columns, items, axis.start, axis.end],
  );

  const onDragStart = (event: DragStartEvent) => {
    setDragging(items[String(event.active.id)] ?? null);
  };

  const onDragMove = (event: DragMoveEvent) => {
    const target = resolveDrop(event);
    setHint(
      target?.kind === 'axis'
        ? { columnId: target.columnId, minutes: target.minutes }
        : null,
    );
  };

  const onDragEnd = (event: DragEndEvent) => {
    const active = items[String(event.active.id)];
    setDragging(null);
    setHint(null);
    if (!active) return;

    const target = resolveDrop(event);
    if (!target) return;

    if (target.kind === 'axis') {
      const { time, dayOffset } = fromAxisMinutes(target.minutes);
      store.moveItem(active.id, {
        columnId: target.columnId,
        time,
        dayOffset,
      });
      return;
    }

    // Tray and list drops both clear the time and take an explicit order.
    const destination = columns[target.columnId];
    const withoutActive = destination.itemIds.filter((id) => id !== active.id);
    const order = [
      ...withoutActive.slice(0, target.index),
      active.id,
      ...withoutActive.slice(target.index),
    ];

    store.moveItem(
      active.id,
      { columnId: target.columnId, time: null },
      order,
    );
  };

  const handleAddItem = useCallback(
    async (columnId: string, time: string | null = null) => {
      const id = await store.addItem(columnId, { time });
      // New cards open straight into title editing.
      if (id) {
        setAutoFocusItemId(id);
        setOpenItemId(id);
      }
    },
    [store],
  );

  if (!city) {
    return (
      <div className="grid flex-1 place-items-center px-6 py-16">
        <EmptyState
          illustration={<CityIllustration />}
          title="No cities yet"
          body="Add your first destination and start turning ideas into a plan."
          action={
            <Button variant="primary" onClick={() => setAddingColumn(false)}>
              <Plus size={17} />
              Add a city
            </Button>
          }
        />
      </div>
    );
  }

  const nothingPlanned =
    timedColumns.length === 0 &&
    listColumns.every((column) => column.itemIds.length === 0);

  // On phones one day fills the viewport; the rail moves between days.
  const visibleTimed =
    compact && timedColumns.length > 0
      ? timedColumns.filter(
          (column) => column.id === (focusColumnId ?? timedColumns[0].id),
        )
      : timedColumns;

  const visibleLists =
    compact && focusColumnId
      ? listColumns.filter((column) => column.id === focusColumnId)
      : listColumns;

  const showTimed = visibleTimed.length > 0;

  return (
    <DndContext
      // Explicit id, or dnd-kit derives its aria-describedby ids from a
      // module-level counter that drifts between the server and client renders
      // and trips a hydration mismatch.
      id="triply-board"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setHint(null);
      }}
    >
      {compact && cityColumns.length > 0 && (
        <ColumnRail
          columns={cityColumns.map((column) => ({
            id: column.id,
            title: column.title,
            timed: column.timed,
            count: column.itemIds.length,
          }))}
          activeId={focusColumnId ?? timedColumns[0]?.id ?? listColumns[0]?.id}
          onSelect={setFocusColumnId}
          onAddColumn={() => setAddingColumn(true)}
        />
      )}

      <div className="scroll-slim relative flex-1 overflow-auto">
        {nothingPlanned ? (
          <div className="grid h-full place-items-center px-6 py-12">
            <EmptyState
              illustration={<CityIllustration />}
              title={`${city.title} — no plans yet`}
              body="This city has a backlog, but nothing on the timeline. Add a day to start scheduling."
              action={
                <Button variant="primary" onClick={() => setAddingColumn(true)}>
                  <Plus size={17} />
                  Add your first day
                </Button>
              }
            />
          </div>
        ) : (
          <div className="flex w-max items-start gap-3 px-4 pt-3 pb-12">
            {showTimed && <AxisGutter axis={axis} height={axisHeight} />}

            {visibleTimed.map((column) => (
              <TimedColumn
                key={column.id}
                columnId={column.id}
                axis={axis}
                width={compact ? `calc(100vw - ${AXIS_GUTTER_PX + 40}px)` : TIMED_COLUMN_PX}
                dropHint={hint?.columnId === column.id ? hint.minutes : null}
                onOpenItem={setOpenItemId}
                onAddItem={handleAddItem}
              />
            ))}

            {visibleLists.map((column) => (
              <ListColumn
                key={column.id}
                columnId={column.id}
                width={compact ? 'calc(100vw - 48px)' : LIST_COLUMN_PX}
                bodyHeight={showTimed ? axisHeight : null}
                onOpenItem={setOpenItemId}
                onAddItem={handleAddItem}
              />
            ))}

            {!compact && (
              <button
                type="button"
                onClick={() => setAddingColumn(true)}
                style={{ width: 168 }}
                className="mt-[42px] flex h-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-[12px] text-muted transition-colors hover:border-brand hover:text-brand"
              >
                <Plus size={17} />
                Add day / list
              </button>
            )}
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && <CardDragOverlay item={dragging} />}
      </DragOverlay>

      <ItemDialog
        itemId={openItemId}
        autoFocusTitle={openItemId === autoFocusItemId}
        onClose={() => {
          setOpenItemId(null);
          setAutoFocusItemId(null);
        }}
      />

      <AddColumnDialog
        open={addingColumn}
        cityId={city.id}
        onClose={() => setAddingColumn(false)}
      />
    </DndContext>
  );
}

/** Mobile day/list switcher. Keeps every column one tap away. */
function ColumnRail({
  columns,
  activeId,
  onSelect,
  onAddColumn,
}: {
  columns: { id: string; title: string; timed: boolean; count: number }[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onAddColumn: () => void;
}) {
  return (
    <div className="scroll-none flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-card px-3 py-2">
      {columns.map((column) => (
        <button
          key={column.id}
          type="button"
          onClick={() => onSelect(column.id)}
          aria-current={column.id === activeId}
          className={cn(
            'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
            column.id === activeId
              ? 'border-brand bg-brand-soft text-brand-on-soft'
              : 'border-line bg-card text-muted',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              column.timed ? 'bg-brand' : 'bg-line-strong',
            )}
          />
          {column.title}
          <span className="text-[10px] opacity-60 tabular-nums">
            {column.count}
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onAddColumn}
        aria-label="Add a day or list"
        className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-muted"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
