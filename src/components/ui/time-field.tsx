'use client';

import { Clock } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

import { Label } from './field';

/**
 * A time field with a list of allowed times, in our own chrome.
 *
 * `<input type="time">` was the obvious thing and it is what the card dialog
 * still uses, but its dropdown is browser UI: unstyleable, differently shaped
 * in every browser, and split into hour and minute columns that make no sense
 * for a value that only ever moves in half hours. So the panel here is ours.
 *
 * The numbers stay typeable — clicking the text itself puts a caret in it, and
 * anywhere else in the field opens the list. Both routes end in `onCommit`,
 * which is handed the raw text: what counts as a valid time is the caller's
 * policy, not this component's.
 */
export function TimeField({
  label,
  hint,
  value,
  options,
  onCommit,
  className,
}: {
  label?: string;
  hint?: string;
  /** The committed value, "HH:MM". The field re-syncs to it on blur. */
  value: string;
  /** The times the list offers, in order, as "HH:MM". */
  options: string[];
  /** Raw field text, or a picked option. The caller validates. */
  onCommit: (time: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputId = useId();
  const listId = useId();

  useEffect(() => setDraft(value), [value]);

  // Anchor the panel to the field. It is portalled because the dialog holding
  // this field clips its own overflow, which would cut the list off at the
  // first row.
  useLayoutEffect(() => {
    if (!open || !fieldRef.current) return;

    const place = () => {
      const rect = fieldRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };

    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // Open on the current value, so the list starts where the eye already is.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const index = options.indexOf(value);
      optionRefs.current[index === -1 ? 0 : index]?.scrollIntoView({
        block: 'center',
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        fieldRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        inputRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const move = (step: 1 | -1) => {
    const from = options.indexOf(value);
    const next = Math.min(
      options.length - 1,
      Math.max(0, (from === -1 ? 0 : from) + step),
    );
    onCommit(options[next]);
  };

  return (
    <div className={className}>
      {label && <Label htmlFor={inputId}>{label}</Label>}

      <div
        ref={fieldRef}
        // Anywhere but the text opens the list. The input stops the event
        // before it reaches here, so a click on the numbers only moves the
        // caret — which is the whole point of keeping a real input.
        onMouseDown={() => setOpen((current) => !current)}
        className={cn(
          'flex h-11 w-full cursor-pointer items-center rounded-[11px] border bg-subtle pr-1 pl-3',
          'transition-colors duration-150 ease-out',
          open ? 'border-brand bg-card' : 'border-line hover:border-line-strong',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          value={draft}
          placeholder="HH:MM"
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            setDraft(event.target.value);
            onCommit(event.target.value);
          }}
          onBlur={() => setDraft(value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (open) move(1);
              else setOpen(true);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              if (open) move(-1);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              setOpen(false);
            }
          }}
          // Only as wide as the digits it holds. Stretching it across the
          // field made the empty strip to the right of "08:00" part of the
          // input, so clicking there dropped a caret instead of opening the
          // list — the click target has to match what the eye reads as text.
          className="w-[5.5ch] shrink-0 cursor-text bg-transparent text-sm text-ink tabular-nums outline-none placeholder:text-faint"
        />

        {/* The rest of the field belongs to the wrapper, so it opens. */}
        <span aria-hidden="true" className="h-full flex-1" />

        <span
          aria-hidden="true"
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-[9px] transition-colors',
            open ? 'text-brand' : 'text-faint',
          )}
        >
          <Clock size={15} />
        </span>
      </div>

      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            aria-label={label}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
            }}
            className="scroll-slim z-50 max-h-56 overflow-y-auto rounded-xl border border-line bg-raised p-1 shadow-float"
          >
            {options.map((option, index) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onCommit(option);
                    setOpen(false);
                    inputRef.current?.focus();
                  }}
                  className={cn(
                    'flex w-full items-center rounded-[9px] px-2.5 py-1.5 text-left text-[13px] tabular-nums',
                    'outline-none transition-colors duration-150',
                    selected
                      ? 'bg-brand-soft font-semibold text-brand-on-soft'
                      : 'text-ink hover:bg-subtle focus-visible:bg-subtle',
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
