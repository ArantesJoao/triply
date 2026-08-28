'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

export type MenuAction = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  /** Trailing text — a shortcut, or the value the item currently holds. */
  hint?: string;
};

/**
 * The anatomy shadcn/Base UI's dropdown menu exposes, minus the parts nothing
 * here needs (submenus, checkbox and radio items): an item, a group heading,
 * and a separator between groups.
 */
export type MenuEntry = MenuAction | { heading: string } | { separator: true };

const isHeading = (entry: MenuEntry): entry is { heading: string } =>
  'heading' in entry;
const isSeparator = (entry: MenuEntry): entry is { separator: true } =>
  'separator' in entry;

/**
 * Small dropdown for the column and card "…" menus. The panel portals to
 * `document.body` so it's never clipped by a parent's `overflow` — the city
 * tabs bar's `overflow-x-auto` was hiding it.
 */
export function Menu({
  trigger,
  actions,
  align = 'end',
}: {
  trigger: (props: {
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
    id: string;
  }) => React.ReactNode;
  actions: MenuEntry[];
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();

  /**
   * Roving focus across the items, the way a menu is expected to behave and
   * the one thing a hand-rolled dropdown usually drops. Only actionable items
   * take focus — headings and separators are skipped.
   */
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusItem = (from: number, step: 1 | -1) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (items.length === 0) return;
    const current = items.findIndex((node) => node === document.activeElement);
    const start = current === -1 ? from : current + step;
    const next = ((start % items.length) + items.length) % items.length;
    items[next]?.focus();
  };

  // Position the portal panel beneath the trigger.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6, // 6px gap (mt-1.5)
      left: align === 'end' ? rect.right : rect.left,
    });
  }, [open, align]);

  // Reposition on scroll / resize while open so the panel follows its trigger.
  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const reposition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        top: rect.bottom + 6,
        left: align === 'end' ? rect.right : rect.left,
      });
    };

    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, align]);

  // Opening with the keyboard should land on the first item, so the menu is
  // usable without reaching for the mouse.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      (itemRefs.current.find(Boolean) as HTMLButtonElement | undefined)?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        // Escape hands focus back to the button that opened the menu, rather
        // than dropping it on the body.
        (
          triggerRef.current?.querySelector('button') as HTMLElement | null
        )?.focus();
        return;
      }
      if (event.key === 'Tab') {
        setOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusItem(0, 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusItem(-1, -1);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="relative shrink-0">
      {trigger({
        onClick: () => setOpen((value) => !value),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        id: triggerId,
      })}

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-labelledby={triggerId}
            style={{
              position: 'fixed',
              top: pos.top,
              ...(align === 'end'
                ? { right: window.innerWidth - pos.left }
                : { left: pos.left }),
            }}
            className="z-50 min-w-48 overflow-hidden rounded-xl border border-line bg-raised p-1 shadow-float"
          >
            {actions.map((entry, index) => {
              if (isSeparator(entry)) {
                return (
                  <div
                    key={`separator-${index}`}
                    role="separator"
                    className="-mx-1 my-1 h-px bg-line"
                  />
                );
              }

              if (isHeading(entry)) {
                return (
                  <div
                    key={`heading-${entry.heading}`}
                    role="presentation"
                    className="px-2.5 pt-1.5 pb-1 font-display text-[11px] font-semibold text-faint"
                  >
                    {entry.heading}
                  </div>
                );
              }

              return (
                <button
                  key={entry.label}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    entry.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] transition-colors duration-150',
                    'outline-none focus-visible:bg-subtle',
                    entry.destructive
                      ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft'
                      : 'text-ink hover:bg-subtle',
                  )}
                >
                  {entry.icon && (
                    <span className="shrink-0 opacity-70">{entry.icon}</span>
                  )}
                  <span className="flex-1">{entry.label}</span>
                  {entry.hint && (
                    <span className="text-[11px] text-faint tabular-nums">
                      {entry.hint}
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
