'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { memo } from 'react';

import { TagChip, TagDots } from '@/components/ui/chip';
import { cn } from '@/lib/cn';

import { type CardDensity } from './geometry';
import { useItem, useTrip, type ItemRecord } from './store';

export type CardVariant = 'axis' | 'list' | 'tray';

/** Axis cards only: how many tag chips fit on one row before the count. */
const AXIS_CHIP_LIMIT = 2;

export type PlanCardProps = {
  itemId: string;
  variant: CardVariant;
  onOpen: (itemId: string) => void;
  /**
   * Axis cards only: how much of the card its slot has room for. The column
   * decides this from the card's *time*, and the card never asks for more —
   * which is what guarantees nothing is ever clipped. See `geometry.ts` for
   * the arithmetic tying each density to an exact rendered height; the line
   * heights below are pinned in px to keep that arithmetic honest.
   */
  density?: CardDensity;
  /** Axis cards only: the slot the packer allocated. */
  style?: React.CSSProperties;
  dimmed?: boolean;
};

function PlanCardInner({
  itemId,
  variant,
  onOpen,
  density = 'full',
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

  if (!item) return null;

  const axis = variant === 'axis';
  // Only an axis card is height-constrained; everywhere else it can be as tall
  // as it likes, so everywhere else renders at full density.
  const fit: CardDensity = axis ? density : 'full';
  const chips = axis ? item.tags.slice(0, AXIS_CHIP_LIMIT) : item.tags;
  const overflowChips = item.tags.length - chips.length;

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
        className={cn(
          'pointer-events-none relative flex gap-1.5',
          variant === 'tray' && 'px-2 py-1.5',
          variant !== 'tray' && (fit === 'compact' ? 'px-2.5 py-1.5' : 'px-2.5 py-2'),
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
          {/* Compact: the time, the title and the tag colours share one line —
              the least a card can be and still be readable. */}
          {fit === 'compact' ? (
            <span className="flex items-center gap-1.5 leading-[18px]">
              <Clock item={item} />
              <Title item={item} variant={variant} className="min-w-0 flex-1" />
              <TagDots tags={item.tags} tagColors={trip.tagColors} />
            </span>
          ) : (
            <>
              {item.time && variant !== 'list' && (
                <span className="flex items-center justify-between gap-1.5 leading-[15px]">
                  <Clock item={item} />
                  {/* Stacked has no room for a tags row, so the tags ride the
                      time line instead of disappearing. */}
                  {fit === 'stacked' && (
                    <TagDots tags={item.tags} tagColors={trip.tagColors} />
                  )}
                </span>
              )}

              <Title item={item} variant={variant} className="block" />

              {variant === 'list' && item.blurb && (
                <span className="mt-1 line-clamp-2 block text-[11.5px] leading-relaxed text-muted">
                  {item.blurb}
                </span>
              )}

              {variant !== 'tray' && fit === 'full' && item.tags.length > 0 && (
                // An axis card's tags row is exactly one 22px line tall, so it
                // must not wrap: past two chips it counts the rest.
                <span
                  className={cn(
                    'mt-1.5 flex gap-1',
                    axis ? 'overflow-hidden' : 'flex-wrap',
                  )}
                >
                  {chips.map((tag) => (
                    <TagChip
                      key={tag}
                      label={tag}
                      tagColors={trip.tagColors}
                      tagIcons={trip.tagIcons}
                      size="sm"
                      className={axis ? 'min-w-0' : undefined}
                    />
                  ))}
                  {overflowChips > 0 && (
                    <span className="shrink-0 self-center text-[10px] font-medium text-faint tabular-nums">
                      +{overflowChips}
                    </span>
                  )}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The start time, `+1` when the stop runs past midnight. Exactly 15px tall. */
function Clock({ item }: { item: ItemRecord }) {
  if (!item.time) return null;

  return (
    <span className="shrink-0 font-display text-[11px] leading-[15px] font-medium text-brand tabular-nums">
      {item.time}
      {item.dayOffset > 0 && (
        <span className="ml-0.5 opacity-70">+{item.dayOffset}</span>
      )}
    </span>
  );
}

/** One line, 18px tall, wherever a card is height-constrained. */
function Title({
  item,
  variant,
  className,
}: {
  item: ItemRecord;
  variant: CardVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-display font-semibold text-ink',
        variant === 'tray'
          ? 'truncate text-[12px] leading-snug'
          : 'text-[13px] leading-[18px]',
        variant === 'axis' && 'truncate',
        className,
      )}
    >
      {item.title || <span className="text-faint italic">Untitled</span>}
    </span>
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
