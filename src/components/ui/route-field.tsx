'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import {
  cleanStops,
  DEFAULT_TRAVEL_MODE,
  TRAVEL_MODE_LABELS,
  TRAVEL_MODES,
  mapsPinFor,
  mapsUrlFor,
  type TravelMode,
} from '@/lib/maps';

import { PillGroup } from './pill-group';
import { AddRow } from './read-field';
import { SheetLabel, useSheetIsMobile } from './sheet';

/**
 * The route.
 *
 * Read mode is the walk in order, each stop its own pin, with one link out to
 * the whole thing in Google Maps. Edit mode is a row per stop: Enter starts the
 * next one, Backspace on an empty row takes it away, and a multi-line paste
 * lands as rows rather than as one stop with the newlines still in it. It is
 * the numbered list from read mode, made typeable — nobody should have to
 * manage their own line breaks to describe a walk.
 *
 * Neither half stores a URL. `src/lib/maps.ts` derives one from the stops and
 * the city every time, so a stop that gets retyped and a card that gets moved
 * to another city both stay correct.
 */

const MODE_OPTIONS = TRAVEL_MODES.map((mode) => ({
  label: TRAVEL_MODE_LABELS[mode],
  value: mode as TravelMode,
}));

/** The dot that carries a stop's number, in both halves of the field. */
const STOP_NUMBER =
  'grid size-5.5 shrink-0 place-items-center rounded-full border border-line bg-subtle font-display text-[10.5px] font-bold text-muted';

function StopNumber({ children }: { children: React.ReactNode }) {
  return <span className={STOP_NUMBER}>{children}</span>;
}

export function RouteRead({
  stops,
  travelMode,
  city,
}: {
  stops: string[];
  travelMode: TravelMode | null;
  city?: string;
}) {
  const url = mapsUrlFor(stops, { city, travelMode });
  if (!url) return null;

  const mode = travelMode ?? DEFAULT_TRAVEL_MODE;

  return (
    <div>
      <ol className="flex flex-col">
        {stops.map((stop, index) => (
          <li
            key={`${index}-${stop}`}
            className="relative flex items-start gap-2.5 pb-2.5 last:pb-0"
          >
            {/* The thread between the dots. Drawn per row rather than behind
                the list so it stops at the last stop instead of running past it. */}
            {index < stops.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-6 bottom-0 left-[10px] w-px bg-line"
              />
            )}
            <StopNumber>{index + 1}</StopNumber>
            <a
              href={mapsPinFor(stop, city)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline-offset-2 transition-colors hover:text-brand hover:underline"
            >
              {stop}
            </a>
          </li>
        ))}
      </ol>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-line px-3.5',
          'text-[12.5px] font-semibold text-brand-on-soft transition-colors',
          'hover:border-brand hover:bg-brand-soft',
        )}
      >
        <MapPin size={14} className="shrink-0" />
        Open in Google Maps
        {mode !== DEFAULT_TRAVEL_MODE && (
          <span className="font-normal text-faint">
            · {TRAVEL_MODE_LABELS[mode].toLowerCase()}
          </span>
        )}
      </a>
    </div>
  );
}

/**
 * One stop: its number, the text, and the way out.
 *
 * The number doubles as the drag handle — it turns into a grip on hover, so
 * reordering costs no extra chrome in a row that is mostly a text field. The
 * whole row is not draggable, because the whole row is where you type.
 */
function StopRow({
  index,
  value,
  count,
  mobile,
  disabled,
  inputRef,
  onChange,
  onKeyDown,
  onPaste,
  onRemove,
}: {
  index: number;
  value: string;
  count: number;
  mobile: boolean;
  disabled: boolean;
  inputRef: (node: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(index), disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2.5',
        isDragging && 'relative z-10 opacity-90',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        disabled={disabled || count < 2}
        aria-label={`Reorder stop ${index + 1}`}
        {...attributes}
        {...listeners}
        className={cn(
          STOP_NUMBER,
          'group touch-none transition-colors',
          count > 1 && !disabled
            ? 'cursor-grab hover:border-line-strong hover:text-ink active:cursor-grabbing'
            : 'cursor-default',
        )}
      >
        <span className={cn(count > 1 && !disabled && 'group-hover:hidden')}>
          {index + 1}
        </span>
        {count > 1 && !disabled && (
          <GripVertical size={12} className="hidden group-hover:block" />
        )}
      </button>

      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={index === 0 ? 'Where it starts' : 'Next stop'}
        aria-label={`Stop ${index + 1}`}
        className={cn(
          'min-w-0 flex-1 rounded-xl border border-line bg-card px-3.5',
          'outline-none transition-shadow duration-150 placeholder:text-faint',
          'focus:border-brand focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]',
          mobile ? 'h-11 text-[15px]' : 'h-10 text-sm',
          disabled && 'opacity-45',
        )}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${value.trim() || `stop ${index + 1}`}`}
        className={cn(
          'grid shrink-0 place-items-center rounded-full text-faint',
          'transition-colors hover:bg-danger-soft hover:text-danger',
          mobile ? 'size-11' : 'size-8',
        )}
      >
        <X size={15} />
      </button>
    </li>
  );
}

export function RouteEditor({
  stops,
  travelMode,
  onChange,
  autoFocus = false,
  disabled = false,
}: {
  stops: string[];
  travelMode: TravelMode | null;
  onChange: (next: { stops: string[]; travelMode: TravelMode | null }) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const mobile = useSheetIsMobile();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  /** Set by whatever just changed the list; spent once that row exists. */
  const [focusRow, setFocusRow] = useState<number | null>(null);

  const setStops = (next: string[]) => onChange({ stops: next, travelMode });

  useEffect(() => {
    if (focusRow === null) return;
    const node = inputs.current[focusRow];
    node?.focus();
    node?.setSelectionRange(node.value.length, node.value.length);
    setFocusRow(null);
  }, [focusRow, stops]);

  // Tapping "Add a route" in read mode should land in a row ready to type in,
  // not on the button that would have made one.
  useEffect(() => {
    if (!autoFocus) return;
    if (stops.length === 0) setStops(['']);
    setFocusRow(0);
    // Only on the way in — a later edit must not steal the caret back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  const replaceAt = (index: number, value: string) =>
    setStops(stops.map((stop, at) => (at === index ? value : stop)));

  const insertAfter = (index: number, values: string[] = ['']) => {
    const next = [...stops];
    next.splice(index + 1, 0, ...values);
    setStops(next);
    setFocusRow(index + values.length);
  };

  const removeAt = (index: number) => {
    setStops(stops.filter((_, at) => at !== index));
    setFocusRow(Math.max(0, index - 1));
  };

  /** Alt+arrow moves the stop itself — the keyboard's answer to dragging. */
  const move = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= stops.length) return;
    setStops(arrayMove(stops, index, to));
    setFocusRow(to);
  };

  const onKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === 'Enter') {
      // A route is a sequence, so Enter means "and then": the next stop,
      // waiting, rather than a submit or a newline to keep track of by hand.
      event.preventDefault();
      insertAfter(index);
    } else if (
      event.key === 'Backspace' &&
      !event.currentTarget.value &&
      stops.length > 1
    ) {
      event.preventDefault();
      removeAt(index);
    } else if (
      event.altKey &&
      (event.key === 'ArrowDown' || event.key === 'ArrowUp')
    ) {
      event.preventDefault();
      move(index, event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'ArrowDown' && index < stops.length - 1) {
      event.preventDefault();
      setFocusRow(index + 1);
    } else if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault();
      setFocusRow(index - 1);
    } else if (event.key === 'Escape') {
      // Leaves the field, not edit mode. The sheet keeps its own Escape.
      event.stopPropagation();
      event.currentTarget.blur();
    }
  };

  /** A pasted list — off a note, a page, a chat — arrives as rows, not as one. */
  const onPaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    const text = event.clipboardData.getData('text');
    if (!text.includes('\n')) return;

    const lines = cleanStops(text.split(/\r?\n/));
    if (lines.length === 0) return;

    event.preventDefault();
    const next = [...stops];
    next.splice(index, 1, ...lines);
    setStops(next);
    setFocusRow(index + lines.length - 1);
  };

  const sensors = useSensors(
    // A little travel before a drag starts, so tapping into a row to type
    // never reads as the beginning of a reorder.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = Number(active.id);
    const to = Number(over.id);
    setStops(arrayMove(stops, from, to));
    setFocusRow(null);
  };

  return (
    <div>
      <SheetLabel>Route</SheetLabel>

      {stops.length > 0 && (
        <DndContext
          // Explicit id: dnd-kit otherwise numbers its aria ids from a
          // module-level counter, which drifts between server and client.
          id="triply-route"
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={stops.map((_, index) => String(index))}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex flex-col gap-1.5">
              {stops.map((stop, index) => (
                // Index-keyed deliberately: two stops can carry the same text,
                // and a row is a position in the walk rather than an identity.
                <StopRow
                  key={index}
                  index={index}
                  value={stop}
                  count={stops.length}
                  mobile={mobile}
                  disabled={disabled}
                  inputRef={(node) => {
                    inputs.current[index] = node;
                  }}
                  onChange={(value) => replaceAt(index, value)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  onPaste={(event) => onPaste(event, index)}
                  onRemove={() => removeAt(index)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <AddRow
        label={stops.length ? 'Add a stop' : 'Add the first stop'}
        className={cn(stops.length > 0 && 'mt-1.5')}
        onClick={() => insertAfter(stops.length - 1)}
      />

      <p className="mt-2 text-[12px] text-faint">
        In the order you walk them — Enter starts the next one, and the number
        drags to reorder. The city is added for you, so “Kingly Court” is
        enough.
      </p>

      <div className={cn('mt-3', disabled && 'opacity-45')}>
        <PillGroup
          options={MODE_OPTIONS}
          value={travelMode ?? DEFAULT_TRAVEL_MODE}
          onChange={(mode) => onChange({ stops, travelMode: mode })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
