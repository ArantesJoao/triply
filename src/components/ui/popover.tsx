'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

/**
 * Anchored floating panel with arbitrary content — the free-form sibling of
 * `Menu`, which only takes a list of actions. Same portal-to-body trick so the
 * panel escapes the board's `overflow` containers, same outside-click/Escape
 * dismissal, and it flips above the trigger when there's no room below.
 */
export function Popover({
  trigger,
  children,
  align = 'start',
  className,
  label,
}: {
  trigger: (props: {
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'dialog';
    id: string;
  }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
  /** Accessible name for the panel. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();

  const [pos, setPos] = useState<{
    top: number;
    left: number;
    placement: 'below' | 'above';
  } | null>(null);

  // Measure after the panel exists so we know whether it fits below.
  useLayoutEffect(() => {
    if (!open) return;

    const reposition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = panelRef.current?.offsetHeight ?? 0;
      const below = rect.bottom + 6;
      const flip = height > 0 && below + height > window.innerHeight - 8;
      setPos({
        top: flip ? rect.top - 6 - height : below,
        left: align === 'end' ? rect.right : rect.left,
        placement: flip ? 'above' : 'below',
      });
    };

    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, align]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };

    // Capture on `window` — one hop earlier than the dialog's own capturing
    // handler on `document` — so Escape closes just the popover, not the
    // dialog it may be sitting inside.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <span ref={triggerRef} className="relative inline-flex">
      {trigger({
        onClick: () => setOpen((value) => !value),
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
        id: triggerId,
      })}

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            aria-labelledby={label ? undefined : triggerId}
            style={{
              position: 'fixed',
              // Hidden until measured, so the flip never flashes.
              visibility: pos ? 'visible' : 'hidden',
              top: pos?.top ?? 0,
              ...(align === 'end'
                ? { right: pos ? window.innerWidth - pos.left : 0 }
                : { left: pos?.left ?? 0 }),
            }}
            className={cn(
              'z-50 rounded-xl border border-line bg-raised p-3 shadow-float',
              className,
            )}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </span>
  );
}
