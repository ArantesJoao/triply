'use client';

import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';
import { isValidTime, normaliseTime, stepTime, TIME_STEP_MINUTES } from '@/lib/time';

import { SheetLabel, useSheetIsMobile } from './sheet';

/**
 * One control for a time: quick chips, then an exact value.
 *
 * The board had three different ways to say "10:00" — the card dialog's native
 * `<input type="time">`, the day-start dialog's own list field, and nothing at
 * all on mobile. This is the shape all of them converge on: five chips for the
 * times this trip actually uses, and a stepper for everything else, with the
 * digits still typeable so 10:15 stays one tap and four keystrokes away.
 *
 * Not the OS wheel picker, deliberately — it can't express "this one is taken"
 * and it can't be told what times a trip favours.
 */
export function TimePicker({
  label = 'Time',
  value,
  onChange,
  onClear,
  /** The trip's common start times, most-used first. */
  options,
  disabled = false,
  placeholder = '--:--',
  /** Lets the parent sheet push itself back while the drawer is over it. */
  onOpenChange,
}: {
  label?: string;
  value: string | null;
  onChange: (time: string) => void;
  onClear?: () => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const mobile = useSheetIsMobile();
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLButtonElement>(null);

  const change = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const close = () => {
    change(false);
    fieldRef.current?.focus();
  };

  return (
    <div>
      {label && <SheetLabel>{label}</SheetLabel>}

      <button
        ref={fieldRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => change(!open)}
        className={cn(
          'flex h-10 w-[124px] items-center rounded-[11px] border pr-1 pl-3 text-left',
          'transition-colors duration-150 ease-out disabled:opacity-40',
          open
            ? 'border-brand bg-card shadow-[0_0_0_3px_rgba(99,102,241,0.12)]'
            : 'border-line bg-subtle hover:border-line-strong',
        )}
      >
        <span
          className={cn(
            'text-sm tabular-nums',
            value ? 'text-ink' : 'text-faint',
          )}
        >
          {value ?? placeholder}
        </span>
        <span className="flex-1" />
        <span
          aria-hidden="true"
          className={cn(
            'grid size-8 shrink-0 place-items-center',
            open ? 'text-brand' : 'text-faint',
          )}
        >
          <Clock size={15} />
        </span>
      </button>

      {open &&
        (mobile ? (
          <TimeDrawer
            title={label}
            value={value}
            options={options}
            onChange={onChange}
            onClear={onClear}
            onClose={close}
          />
        ) : (
          <TimePopover
            anchor={fieldRef}
            label={label}
            value={value}
            options={options}
            onChange={onChange}
            onClear={onClear}
            onClose={close}
          />
        ))}
    </div>
  );
}

/* --------------------------------------------------------------------- *
 * The panel's contents — identical either side of the breakpoint, only the
 * touch targets grow.
 * --------------------------------------------------------------------- */

function TimePanel({
  value,
  options,
  onChange,
  size,
}: {
  value: string | null;
  options: string[];
  onChange: (time: string) => void;
  size: 'compact' | 'touch';
}) {
  const touch = size === 'touch';
  const exact = isValidTime(value) ? value : '09:00';
  const [draft, setDraft] = useState(exact);

  useEffect(() => setDraft(exact), [exact]);

  const step = (direction: 1 | -1) =>
    onChange(stepTime(exact, direction * TIME_STEP_MINUTES));

  return (
    <>
      <div className={cn('flex flex-wrap', touch ? 'gap-2' : 'gap-1.5')}>
        {options.map((option) => {
          // A chip and the stepper are the same value, so the chip lights up
          // whenever the exact time happens to match it.
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={cn(
                'inline-flex items-center rounded-full tabular-nums transition-colors duration-150 ease-out',
                touch ? 'h-11 px-4 text-[15px]' : 'h-8 px-3 text-[12.5px]',
                selected
                  ? 'bg-brand font-semibold text-brand-contrast'
                  : 'border border-line text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          'mt-2.5 flex items-center gap-2.5 rounded-[14px] border border-line bg-subtle pr-1.5 pl-4',
          touch ? 'h-15' : 'h-12',
        )}
      >
        <span className="text-[11px] tracking-[0.06em] text-faint uppercase">
          Exact
        </span>
        <span className="flex-1" />

        <input
          value={draft}
          inputMode="numeric"
          aria-label="Exact time"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setDraft(event.target.value);
            const parsed = normaliseTime(event.target.value);
            if (parsed) onChange(parsed);
          }}
          onBlur={() => setDraft(exact)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              step(1);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              step(-1);
            }
          }}
          className={cn(
            'w-[5ch] bg-transparent text-right font-display font-bold tabular-nums outline-none',
            touch ? 'text-[22px]' : 'text-lg',
          )}
        />

        <div className="flex flex-col gap-0.5">
          <Stepper label="Later" onStep={() => step(1)} touch={touch}>
            <ChevronUp size={touch ? 15 : 13} />
          </Stepper>
          <Stepper label="Earlier" onStep={() => step(-1)} touch={touch}>
            <ChevronDown size={touch ? 15 : 13} />
          </Stepper>
        </div>
      </div>
    </>
  );
}

/** Press-and-hold repeats after 500ms, then four steps a second. */
function Stepper({
  label,
  onStep,
  touch,
  children,
}: {
  label: string;
  onStep: () => void;
  touch: boolean;
  children: React.ReactNode;
}) {
  const timers = useRef<number[]>([]);

  const stop = () => {
    for (const timer of timers.current) window.clearInterval(timer);
    timers.current = [];
  };

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onStep}
      onPointerDown={() => {
        stop();
        const delay = window.setTimeout(() => {
          timers.current.push(window.setInterval(onStep, 250));
        }, 500);
        timers.current.push(delay);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className={cn(
        'grid place-items-center rounded-lg border border-line bg-card text-muted',
        'transition-colors hover:border-line-strong hover:text-ink',
        touch ? 'h-6.5 w-11' : 'h-5 w-8.5',
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------------- *
 * Placement
 * --------------------------------------------------------------------- */

function TimePopover({
  anchor,
  label,
  value,
  options,
  onChange,
  onClear,
  onClose,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>;
  label: string;
  value: string | null;
  options: string[];
  onChange: (time: string) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const height = panelRef.current?.offsetHeight ?? 0;
      const below = rect.bottom + 4;
      const flip = height > 0 && below + height > window.innerHeight - 8;
      setPos({ top: flip ? rect.top - 4 - height : below, left: rect.left });
    };

    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchor.current?.contains(target) || panelRef.current?.contains(target))
        return;
      onClose();
    };
    // Capture on `window` — one hop ahead of the sheet's own handler on
    // `document` — so Escape closes the popover and not the sheet behind it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    // The sheet's body scrolls under the popover; following it would be worse
    // than dismissing.
    const onScroll = () => onClose();

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      data-sheet-popover
      role="dialog"
      aria-label={label}
      style={{
        position: 'fixed',
        visibility: pos ? 'visible' : 'hidden',
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
      }}
      className="z-[60] w-[284px] rounded-2xl border border-line bg-raised p-3 shadow-float"
    >
      <TimePanel value={value} options={options} onChange={onChange} size="compact" />

      {onClear && (
        <div className="mt-2.5 flex justify-end border-t border-line pt-2.5">
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="text-[12.5px] font-semibold text-brand-on-soft hover:underline"
          >
            Clear
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}

/**
 * The mobile half: a drawer over the parent sheet, which scales back behind
 * it. Hand-rolled rather than a nested `Sheet` so it can claim Escape on
 * `window` before the parent's `document` handler ever sees the key.
 */
function TimeDrawer({
  title,
  value,
  options,
  onChange,
  onClear,
  onClose,
}: {
  title: string;
  value: string | null;
  options: string[];
  onChange: (time: string) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div data-sheet-popover className="fixed inset-0 z-[60] flex items-end">
      <div
        aria-hidden="true"
        onMouseDown={onClose}
        style={{ opacity: shown ? 1 : 0, transition: 'opacity 200ms linear' }}
        className="absolute inset-0 bg-[rgba(15,18,48,0.35)]"
      />
      <div
        role="dialog"
        aria-label={title}
        style={{
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 500ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        className="relative w-full rounded-t-2xl bg-card px-[18px] pt-2 pb-6 shadow-[0_-8px_34px_rgba(15,18,48,0.28)]"
      >
        <div aria-hidden="true" className="flex justify-center pb-3">
          <span className="h-2 w-25 rounded-full bg-line" />
        </div>

        <div className="mb-3.5 flex items-center gap-2.5">
          <h3 className="font-display text-[17px] font-black">{title}</h3>
          <span className="flex-1" />
          {onClear && (
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="text-[13px] font-semibold text-brand-on-soft"
            >
              Clear
            </button>
          )}
        </div>

        <TimePanel value={value} options={options} onChange={onChange} size="touch" />
      </div>
    </div>,
    document.body,
  );
}
