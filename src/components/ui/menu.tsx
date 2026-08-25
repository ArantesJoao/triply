'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

export type MenuAction = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  hint?: string;
};

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
  actions: MenuAction[];
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();

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
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="relative">
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
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] transition-colors duration-150',
                  action.destructive
                    ? 'text-danger hover:bg-danger-soft'
                    : 'text-ink hover:bg-subtle',
                )}
              >
                {action.icon && (
                  <span className="shrink-0 opacity-70">{action.icon}</span>
                )}
                <span className="flex-1">{action.label}</span>
                {action.hint && (
                  <span className="text-[11px] text-faint">{action.hint}</span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
