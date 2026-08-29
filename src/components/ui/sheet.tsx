'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useMediaQuery } from '@/components/board/use-media-query';
import { cn } from '@/lib/cn';

/**
 * One shell, two shapes: a centred modal at `md` and above, a bottom drawer
 * below it.
 *
 * The board had every modal choosing its own responsive behaviour, which in
 * practice meant none of them chose one — the same centred panel with a 10vh
 * top inset appeared on a 390px phone. `Sheet` makes that decision once, at
 * the board's existing `md` breakpoint, so a modal only describes its content.
 *
 * It deliberately does not extend `ui/dialog.tsx`. That shell is shared by the
 * share, tags, import and day-start dialogs, and reshaping it to serve both
 * would mean changing four modals to redesign two. The overlap is the focus
 * trap and the scroll lock, which are short; the divergence is everything
 * else.
 */

/** Matches the board's own `md`. */
export const SHEET_BREAKPOINT = '(min-width: 768px)';

export function useSheetIsMobile(): boolean {
  return !useMediaQuery(SHEET_BREAKPOINT);
}

function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

const WIDTHS = { sm: 'md:max-w-[400px]', md: 'md:max-w-[448px]', lg: 'md:max-w-[512px]' };

/** Drawer in, drawer out, modal in, modal out — the spec's four durations. */
const TIMING = {
  drawerIn: 500,
  drawerOut: 350,
  modalIn: 180,
  modalOut: 150,
  reduced: 100,
};

const DRAWER_CURVE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const MODAL_CURVE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Release past a quarter of the sheet, or throw it faster than this. */
const DISMISS_FRACTION = 0.25;
const DISMISS_VELOCITY = 0.4;

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the panel. */
  label: string;
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** Desktop panel width. */
  width?: 'sm' | 'md' | 'lg';
  /**
   * `full` is the 90%-of-viewport sheet with a scrolling body; `content` sits
   * at its natural height. Three fields don't need a full screen.
   */
  height?: 'full' | 'content';
  /**
   * False while a request is in flight — overlay tap, drag and Escape all stop
   * working, so a half-created record can't be orphaned by a stray gesture.
   */
  dismissible?: boolean;
  /** Pushed back under a nested drawer: scaled to .96, lifted, dimmed. */
  raised?: boolean;
  /**
   * Called before a dismissal the *user* asked for — overlay tap, Escape, or a
   * drag past the threshold. Return false to veto it, which is how a sheet
   * with unsaved changes gets to ask first instead of vanishing.
   */
  onDismissAttempt?: () => boolean;
};

export function Sheet({
  open,
  onClose,
  label,
  children,
  header,
  footer,
  width = 'md',
  height = 'full',
  dismissible = true,
  raised = false,
  onDismissAttempt,
}: SheetProps) {
  const mobile = useSheetIsMobile();
  const reduced = usePrefersReducedMotion();

  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  /** `entering` for one frame, then `open`; `leaving` plays the exit. */
  const [phase, setPhase] = useState<'entering' | 'open' | 'leaving'>('entering');
  const [dragY, setDragY] = useState<number | null>(null);

  const duration = reduced
    ? TIMING.reduced
    : mobile
      ? phase === 'leaving'
        ? TIMING.drawerOut
        : TIMING.drawerIn
      : phase === 'leaving'
        ? TIMING.modalOut
        : TIMING.modalIn;

  /** Plays the exit, then hands control back. */
  const requestClose = useCallback(() => {
    if (!dismissible) return;
    if (onDismissAttempt && onDismissAttempt() === false) return;
    setPhase((current) => (current === 'leaving' ? current : 'leaving'));
  }, [dismissible, onDismissAttempt]);

  // Reset the phase every time the sheet is opened, so a reopen animates in
  // rather than appearing mid-exit.
  useEffect(() => {
    if (!open) return;
    setPhase('entering');
    setDragY(null);
    const frame = requestAnimationFrame(() => setPhase('open'));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Held in a ref because callers pass an inline arrow: re-running this on a
  // new `onClose` identity would restart the timer on every render that lands
  // during the exit, and the sheet would never actually close.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = window.setTimeout(() => onCloseRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [phase, duration]);

  /* --- focus, Escape, scroll lock ---------------------------------- */

  /**
   * Escape, the focus trap and the scroll lock are set up once per opening and
   * torn down once, on close.
   *
   * The identities below are held in refs to keep them out of the dependency
   * list. This effect's cleanup hands focus back to whatever opened the sheet,
   * so anything that makes it re-run mid-life pulls the caret out of the field
   * being typed into — and `onDismissAttempt` arrives as an inline arrow, which
   * would otherwise re-run it on every single render.
   */
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // A menu or popover opened from inside the sheet owns Escape first.
        // Both close on the bubble phase, which runs after this one.
        if (document.querySelector('[role="menu"], [data-sheet-popover]')) return;
        if (!dismissibleRef.current) return;
        event.stopPropagation();
        requestCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      restoreTo.current?.focus?.();
    };
  }, [open]);

  // Focus the panel itself rather than the first control: the sheet opens in
  // read mode, where there is nothing to type into and stealing focus into a
  // stray button would announce the wrong thing.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (!panelRef.current?.contains(document.activeElement)) {
        panelRef.current?.focus();
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  /* --- drag to dismiss --------------------------------------------- */

  const drag = useRef<{
    id: number;
    from: number;
    at: number;
    /**
     * The last position an actual move reported. The release decision reads
     * this rather than the up/cancel event: when the browser decides mid-drag
     * that the gesture was a scroll it fires `pointercancel`, and that event's
     * coordinates are wherever the finger was when it took over — usually a
     * few pixels from the start, which would throw away a drag the user had
     * already pulled halfway down the screen.
     */
    last: number;
  } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!mobile || !dismissible) return;
    // Only from the handle, or from a body that is scrolled to the top —
    // otherwise the gesture belongs to the scroll container.
    // While the keyboard is up, the first downward gesture belongs to the
    // keyboard — dismissing the sheet out from under a half-typed field is
    // never what the thumb meant.
    const active = document.activeElement;
    if (
      active &&
      panelRef.current?.contains(active) &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    ) {
      return;
    }

    const fromHandle = (event.target as HTMLElement).closest('[data-sheet-handle]');
    if (!fromHandle && (bodyRef.current?.scrollTop ?? 0) > 0) return;
    // Never steal a drag that starts on something the finger is aiming at.
    if (!fromHandle && (event.target as HTMLElement).closest('input, textarea, button, a, [role="radio"]'))
      return;

    drag.current = {
      id: event.pointerId,
      from: event.clientY,
      at: performance.now(),
      last: event.clientY,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;

    // The sheet follows the finger 1:1 downward and not at all upward.
    const delta = event.clientY - state.from;
    if (delta <= 0) {
      setDragY(0);
      return;
    }
    // Capture only once the gesture has committed downward, so a tap that
    // wobbles by a pixel still lands on what it was aiming at.
    if (delta > 4) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    state.last = event.clientY;
    setDragY(delta);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;

    const delta = Math.max(0, state.last - state.from);
    const elapsed = Math.max(1, performance.now() - state.at);
    const velocity = delta / elapsed; // px per ms
    const sheetHeight = panelRef.current?.offsetHeight ?? 1;

    // Past a quarter of the way down, or thrown hard enough — anything less
    // springs back on the same curve.
    setDragY(null);
    if (delta > sheetHeight * DISMISS_FRACTION || velocity > DISMISS_VELOCITY) {
      requestClose();
    }
  };

  if (!open || typeof document === 'undefined') return null;

  const leaving = phase === 'leaving';
  const hidden = phase !== 'open';

  /* --- geometry ----------------------------------------------------- */

  /**
   * When the software keyboard opens, the sheet gives up the height the
   * keyboard took rather than being pushed off the top of the screen — so the
   * caret and the sticky footer both stay where they were. `dvh` already
   * tracks this on most mobile browsers; `keyboard-inset-height` covers the
   * ones where the visual viewport doesn't move.
   */
  const drawerHeight =
    height === 'full'
      ? 'calc(90dvh - env(keyboard-inset-height, 0px))'
      : undefined;

  const panelStyle: React.CSSProperties = mobile
    ? {
        height: drawerHeight,
        maxHeight: '90dvh',
        transform: raised
          ? 'translateY(-12px) scale(0.96)'
          : dragY != null
            ? `translateY(${dragY}px)`
            : hidden
              ? 'translateY(100%)'
              : 'translateY(0)',
        transition:
          dragY != null
            ? 'none'
            : `transform ${duration}ms ${reduced ? 'linear' : DRAWER_CURVE}, height ${duration}ms ${DRAWER_CURVE}, opacity ${duration}ms linear`,
        opacity: reduced && hidden ? 0 : 1,
      }
    : {
        transform: reduced
          ? undefined
          : hidden
            ? 'translateY(8px) scale(0.98)'
            : 'translateY(0) scale(1)',
        opacity: hidden ? 0 : 1,
        transition: `transform ${duration}ms ${MODAL_CURVE}, opacity ${duration}ms linear`,
      };

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex',
        // Desktop centres the panel and caps it; the drawer is bottom-anchored
        // and sizes itself. Neither scrolls the overlay — the body does.
        mobile ? 'items-end' : 'items-center justify-center p-4',
      )}
    >
      {/* Overlay */}
      <div
        aria-hidden="true"
        onMouseDown={() => requestClose()}
        style={{
          opacity: hidden ? 0 : 1,
          transition: `opacity ${leaving ? duration : 150}ms linear`,
        }}
        className={cn(
          'absolute inset-0',
          mobile ? 'bg-[rgba(15,18,48,0.55)]' : 'bg-[rgba(15,18,48,0.42)] backdrop-blur-[2px]',
          !dismissible && 'cursor-default',
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={panelStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'relative flex w-full flex-col bg-card outline-none',
          mobile
            ? 'rounded-t-2xl shadow-[0_-8px_34px_rgba(15,18,48,0.28)]'
            : cn(
                'max-h-[80vh] overflow-hidden rounded-[20px] border border-line shadow-float',
                WIDTHS[width],
              ),
          raised && 'pointer-events-none',
        )}
      >
        {/*
          * Drag handle. Draws at 8px, catches at 44.
          *
          * `touch-action: none` is what makes the drag work at all on a
          * touchscreen: without it the browser claims the vertical gesture for
          * the nearest scroller before our handlers see enough of it, then
          * fires `pointercancel` and the sheet springs back. The handle and
          * the header don't scroll, so they give the whole gesture up to us.
          */}
        {mobile && (
          <div
            data-sheet-handle
            aria-hidden="true"
            style={{ touchAction: 'none' }}
            className="flex h-11 shrink-0 items-start justify-center pt-2"
          >
            <span className="h-2 w-25 rounded-full bg-line" />
          </div>
        )}

        {header && (
          <div
            className="shrink-0"
            style={mobile ? { touchAction: 'none' } : undefined}
          >
            {header}
          </div>
        )}

        <div
          ref={bodyRef}
          // Only the drawer is height-capped, so only there does this actually
          // scroll; on desktop the panel grows and the overlay scrolls instead,
          // which is what `ui/dialog.tsx` has always done.
          style={{ overscrollBehavior: 'contain' }}
          className="scroll-slim min-h-0 flex-1 overflow-y-auto"
        >
          {children}
        </div>

        {footer && <div className="shrink-0">{footer}</div>}

        {/* Dims the parent while a nested drawer sits over it. */}
        {raised && (
          <div aria-hidden="true" className="absolute inset-0 rounded-t-2xl bg-black/20" />
        )}
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------------------------------------------------- *
 * Slots
 * --------------------------------------------------------------------- */

export function SheetBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const mobile = useSheetIsMobile();
  return (
    <div className={cn(mobile ? 'px-[18px] py-4' : 'p-5', className)}>{children}</div>
  );
}

/**
 * Desktop puts secondary actions on the left and the primary pair on the
 * right; mobile carries the primary pair only, full width, because the header
 * `⋯` holds everything else.
 */
export function SheetFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const mobile = useSheetIsMobile();
  return (
    <footer
      className={cn(
        'flex items-center border-t border-line bg-subtle',
        mobile ? 'gap-2.5 px-[18px] pt-3 pb-6' : 'gap-2 px-5 py-3.5',
        className,
      )}
    >
      {children}
    </footer>
  );
}

/** The uppercase micro-label above every field, in both modes. */
export function SheetLabel({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'mb-2 block font-display text-[10px] font-medium tracking-[0.13em] text-faint uppercase',
        className,
      )}
    >
      {children}
    </label>
  );
}
