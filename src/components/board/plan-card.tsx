'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { TagChip } from '@/components/ui/chip';
import { cn } from '@/lib/cn';

import { useItem, useTrip, type ItemRecord } from './store';

export type CardVariant = 'axis' | 'list' | 'tray';

/**
 * Reports the card's *natural* content height so the column can size its axis
 * slot from what actually rendered. Nothing here assumes a card height — that
 * assumption is exactly what broke the prototype once cards grew a tags row.
 */
function useMeasuredHeight(
  enabled: boolean,
  onMeasure: ((height: number) => void) | undefined,
) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!enabled || !onMeasure || !ref.current) return;

    const node = ref.current;
    onMeasure(node.getBoundingClientRect().height);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // borderBoxSize, NOT contentRect: contentRect excludes padding, which
        // measured every card short by its vertical padding and clipped the
        // bottom of the tags row.
        const height =
          entry.borderBoxSize?.[0]?.blockSize ??
          (entry.target as HTMLElement).offsetHeight;
        onMeasure(height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onMeasure]);

  return ref;
}

export type PlanCardProps = {
  itemId: string;
  variant: CardVariant;
  onOpen: (itemId: string) => void;
  /** Axis cards only: natural content height in px. Must be referentially stable. */
  onMeasure?: (itemId: string, height: number) => void;
  /** Axis cards only: discard the remembered span when content shrinks. */
  onContentChange?: (itemId: string) => void;
  /** Axis cards only: the slot the packer allocated. */
  style?: React.CSSProperties;
  dimmed?: boolean;
};

function PlanCardInner({
  itemId,
  variant,
  onOpen,
  onMeasure,
  onContentChange,
  style,
  dimmed = false,
}: PlanCardProps) {
  const item = useItem(itemId);
  const trip = useTrip();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: itemId,
    data: { type: 'item', columnId: item?.columnId },
  });

  const measure = useCallback(
    (height: number) => onMeasure?.(itemId, height),
    [onMeasure, itemId],
  );
  const contentRef = useMeasuredHeight(variant === 'axis', onMeasure && measure);

  // When the content shrinks — a tag removed, a shorter title — the remembered
  // span must be released so the slot can tighten back up.
  // Only fields that affect the card's *natural rendered height* belong here.
  // time and durationMin affect the card's position/slot on the axis but not
  // its content height, so changing them must NOT release the measurement —
  // ResizeObserver won't re-fire (the content didn't resize) and the card
  // stays clipped at the minimum slot height.
  const signature = item ? `${item.title}|${item.tags.join(',')}` : '';
  useEffect(() => {
    onContentChange?.(itemId);
  }, [signature, onContentChange, itemId]);

  if (!item) return null;

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      data-dragging={isDragging || undefined}
      // Layout hook for scripts/verify-axis.ts, which asserts that a given
      // time lands at the same Y in every timed column.
      data-item-time={
        variant === 'axis' && item.time
          ? `${item.time}+${item.dayOffset}`
          : undefined
      }
      className={cn(
        'group/card overflow-hidden border border-line bg-card',
        'transition-[border-color,box-shadow,opacity] duration-150 ease-out',
        variant === 'axis'
          ? 'absolute rounded-lg border-l-[3px] border-l-brand shadow-card'
          : 'relative rounded-lg',
        variant === 'tray' && 'rounded-[10px] bg-card',
        variant === 'list' && 'bg-card hover:border-line-strong',
        // Lift, keep real dimensions, subtle shadow — never detached-looking.
        isDragging && 'z-30 opacity-40',
        dimmed && 'opacity-40',
      )}
    >
      {/* The whole card opens the item, not just the words on it.
          An axis card is as tall as its slot — a 90-minute dinner is a tall
          box with two lines of text at the top — so a click target that only
          covered the text left most of the card dead. This sits under the
          content and takes every click the content does not claim for
          itself; the content is pointer-transparent, and the drag handle
          opts back in. */}
      <button
        type="button"
        onClick={() => onOpen(itemId)}
        aria-label={`Open ${item.title || 'card'}`}
        className="absolute inset-0 cursor-pointer"
      />

      <div
        ref={contentRef}
        className={cn(
          'pointer-events-none relative flex gap-1.5',
          variant === 'tray' ? 'px-2 py-1.5' : 'px-2.5 py-2',
        )}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${item.title || 'card'}`}
          className={cn(
            'pointer-events-auto mt-px -ml-1 flex shrink-0 cursor-grab touch-none items-start justify-center',
            'rounded text-faint opacity-50 transition-opacity active:cursor-grabbing',
            'hover:opacity-100 group-hover/card:opacity-100 focus-visible:opacity-100',
            // Comfortable touch target without stealing visual weight.
            'w-5 self-stretch',
          )}
        >
          <GripVertical size={13} />
        </button>

        <div className="min-w-0 flex-1 text-left">
          {item.time && variant !== 'list' && (
            <span className="font-display text-[11px] font-medium text-brand tabular-nums">
              {item.time}
              {item.dayOffset > 0 && (
                <span className="ml-0.5 opacity-70">+{item.dayOffset}</span>
              )}
            </span>
          )}

          <span
            className={cn(
              'block font-display font-semibold text-ink',
              variant === 'tray'
                ? 'truncate text-[12px] leading-snug'
                : 'text-[13px] leading-snug',
              variant === 'axis' && 'truncate',
            )}
          >
            {item.title || (
              <span className="text-faint italic">Untitled</span>
            )}
          </span>

          {variant === 'list' && item.blurb && (
            <span className="mt-1 line-clamp-2 block text-[11.5px] leading-relaxed text-muted">
              {item.blurb}
            </span>
          )}

          {variant !== 'tray' && item.tags.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <TagChip
                  key={tag}
                  label={tag}
                  tagColors={trip.tagColors}
                  tagIcons={trip.tagIcons}
                  size="sm"
                />
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Memoised: a card only re-renders when its own record changes, so editing one
 * title doesn't touch the rest of the board.
 */
export const PlanCard = memo(PlanCardInner);

/** What follows the cursor during a drag. Keeps the card's real look. */
export function CardDragOverlay({ item }: { item: ItemRecord }) {
  return (
    <div className="w-56 rounded-lg border border-brand bg-card px-2.5 py-2 shadow-float">
      {item.time && (
        <span className="font-display text-[11px] font-medium text-brand tabular-nums">
          {item.time}
        </span>
      )}
      <span className="block truncate font-display text-[13px] leading-snug font-semibold">
        {item.title || 'Untitled'}
      </span>
    </div>
  );
}
