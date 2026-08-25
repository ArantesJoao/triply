'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

export type MenuAction = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  hint?: string;
};

/**
 * Small dropdown for the column and card "…" menus. Closes on outside click,
 * Escape, or selection; opens leftward so it never runs off the board's right
 * edge.
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
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
    <div ref={rootRef} className="relative">
      {trigger({
        onClick: () => setOpen((value) => !value),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        id: triggerId,
      })}

      {open && (
        <div
          role="menu"
          aria-labelledby={triggerId}
          className={cn(
            'absolute top-full z-40 mt-1.5 min-w-48 overflow-hidden rounded-xl border border-line bg-raised p-1 shadow-float',
            align === 'end' ? 'right-0' : 'left-0',
          )}
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
        </div>
      )}
    </div>
  );
}
