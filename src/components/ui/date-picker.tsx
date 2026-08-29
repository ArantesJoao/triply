'use client';

import { AlertCircle, Calendar, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import {
  addDaysISO,
  addMonthsISO,
  formatDateLong,
  formatDateShort,
  formatMonthTitle,
  isSameMonth,
  isValidDate,
  monthGrid,
} from '@/lib/time';

import { SheetLabel, useSheetIsMobile } from './sheet';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Quick picks up front, the full calendar one tap away.
 *
 * A date field in this app is almost always answering "the next day", and a
 * month grid is a lot of chrome for that. So the first three free dates are
 * chips; the calendar expands in place behind "Another date" — the same
 * calendar, nothing reduced, for the case where the answer is a fortnight out.
 *
 * The resolved date is always stated in full underneath, so tapping a chip is
 * never ambiguous about which "Fri 9" it meant.
 */
export function DatePicker({
  label = 'Date',
  value,
  onChange,
  /** Earliest selectable date, inclusive. */
  min,
  /** Dates the city already has a day for — shown, but not choosable. */
  taken = [],
  disabled = false,
  invalid = false,
  error,
}: {
  label?: string;
  value: string;
  onChange: (date: string) => void;
  min: string;
  taken?: string[];
  disabled?: boolean;
  invalid?: boolean;
  error?: string;
}) {
  const mobile = useSheetIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [month, setMonth] = useState(() => (isValidDate(value) ? value : min));
  const [focused, setFocused] = useState(() => (isValidDate(value) ? value : min));
  const gridRef = useRef<HTMLDivElement>(null);

  const takenSet = useMemo(() => new Set(taken), [taken]);

  /** The next three dates at or after `min` that no day has claimed yet. */
  const quickPicks = useMemo(() => {
    const picks: string[] = [];
    let cursor = min;
    // Bounded so a pathological `taken` set can't spin here.
    for (let step = 0; step < 90 && picks.length < 3; step += 1) {
      if (!takenSet.has(cursor)) picks.push(cursor);
      cursor = addDaysISO(cursor, 1);
    }
    return picks;
  }, [min, takenSet]);

  // Follow the value into its own month, so opening the calendar on a date
  // picked weeks ago doesn't land on today.
  useEffect(() => {
    if (isValidDate(value)) {
      setMonth(value);
      setFocused(value);
    }
  }, [value]);

  const choosable = (date: string) => date >= min && !takenSet.has(date);

  const commit = (date: string) => {
    if (disabled || !choosable(date)) return;
    onChange(date);
    // The calendar was opened to answer one question. It has been answered.
    setExpanded(false);
  };

  const onGridKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in moves) {
      event.preventDefault();
      const next = addDaysISO(focused, moves[event.key]);
      setFocused(next);
      if (!isSameMonth(next, month)) setMonth(next);
      return;
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const next = addMonthsISO(focused, event.key === 'PageUp' ? -1 : 1);
      setFocused(next);
      setMonth(next);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(focused);
      return;
    }
    if (event.key === 'Escape') {
      // Collapse without changing the value; the sheet keeps the key.
      event.stopPropagation();
      setExpanded(false);
    }
  };

  // Keep the DOM focus on whichever day the arrow keys have landed on.
  useEffect(() => {
    if (!expanded) return;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-date="${focused}"]`)
      ?.focus({ preventScroll: true });
  }, [expanded, focused, month]);

  const chip = mobile
    ? 'h-11 px-4 text-sm'
    : 'h-9 px-3.5 text-[12.5px]';

  return (
    <div>
      <SheetLabel>{label}</SheetLabel>

      <div className={cn('flex flex-wrap', mobile ? 'gap-2' : 'gap-1.5')}>
        {quickPicks.map((date, index) => {
          const selected = date === value && !invalid;
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => commit(date)}
              className={cn(
                'inline-flex items-center rounded-full font-display font-bold whitespace-nowrap',
                'transition-colors duration-150 ease-out disabled:opacity-50',
                chip,
                selected
                  ? 'bg-brand text-brand-contrast'
                  : 'border border-line text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {formatDateShort(date)}
              {index === 0 && !mobile && (
                <span className="ml-1.5 font-medium opacity-70">next day</span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          disabled={disabled}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full whitespace-nowrap',
            'transition-colors duration-150 ease-out disabled:opacity-50',
            chip,
            expanded
              ? 'bg-brand font-semibold text-brand-contrast'
              : 'border border-dashed border-line-strong text-brand-on-soft hover:border-brand',
          )}
        >
          <Calendar size={mobile ? 15 : 14} />
          Another date
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 rounded-2xl border border-line bg-card p-3 shadow-[0_6px_18px_rgba(15,18,48,0.08)]">
          <div className="mb-2.5 flex items-center gap-2">
            <CalendarNav
              label="Previous month"
              onClick={() => setMonth(addMonthsISO(month, -1))}
              // Nothing before the minimum is choosable, so paging past its
              // month is a dead end rather than a discovery.
              disabled={addMonthsISO(month, -1).slice(0, 7) < min.slice(0, 7)}
            >
              <ChevronLeft size={15} />
            </CalendarNav>
            <span className="flex-1 text-center font-display text-[13px] font-bold">
              {formatMonthTitle(month)}
            </span>
            <CalendarNav
              label="Next month"
              onClick={() => setMonth(addMonthsISO(month, 1))}
            >
              <ChevronRight size={15} />
            </CalendarNav>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] text-faint">
            {WEEKDAYS.map((day, index) => (
              <span key={index}>{day}</span>
            ))}
          </div>

          <div
            ref={gridRef}
            role="grid"
            aria-label={formatMonthTitle(month)}
            onKeyDown={onGridKeyDown}
            className="grid grid-cols-7 gap-0.5 text-center text-[12.5px]"
          >
            {monthGrid(month).map((date) => {
              const inMonth = isSameMonth(date, month);
              const isTaken = takenSet.has(date);
              const available = choosable(date);
              const selected = date === value;

              return (
                <button
                  key={date}
                  type="button"
                  data-date={date}
                  role="gridcell"
                  disabled={!available || disabled}
                  aria-selected={selected}
                  tabIndex={date === focused ? 0 : -1}
                  onClick={() => commit(date)}
                  className={cn(
                    'grid h-8 place-items-center rounded-[9px] transition-colors duration-150',
                    selected && 'bg-brand font-semibold text-brand-contrast',
                    // A day the city already has reads as occupied, not absent.
                    !selected && isTaken && 'bg-inset text-muted',
                    !selected && !isTaken && !available && 'text-faint/60',
                    !selected && available && inMonth && 'text-ink hover:bg-subtle',
                    !selected && available && !inMonth && 'text-faint hover:bg-subtle',
                    'disabled:cursor-default',
                  )}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* The resolved date, always, so a chip tap is never ambiguous. */}
      {invalid ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </p>
      ) : (
        <div
          className={cn(
            'mt-2.5 flex items-center gap-2 rounded-[14px] border border-line bg-subtle px-3.5',
            mobile ? 'py-3 text-sm' : 'py-2.5 text-[13px]',
          )}
        >
          <Check size={mobile ? 15 : 14} className="shrink-0 text-brand-on-soft" />
          <span>
            {formatDateLong(value)}
            {value === min && (
              <span className="text-faint"> · first free day</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function CalendarNav({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-[9px] text-muted transition-colors hover:bg-subtle hover:text-ink disabled:cursor-default disabled:text-faint/50 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
