'use client';

import { Plus } from 'lucide-react';

import { cn } from '@/lib/cn';

import { SheetLabel } from './sheet';

/**
 * Read mode renders values as type — no input borders, no placeholder text.
 * Two shapes: a labelled block, and the dashed row an empty field collapses
 * into.
 */

export function ReadSection({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <SheetLabel>{label}</SheetLabel>
      {children}
    </div>
  );
}

/**
 * What an empty field looks like: one faint dashed row per missing value.
 * Tapping it enters edit mode with that field focused, which is the only route
 * into editing that skips the Edit button.
 */
export function AddRow({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-11 w-full items-center gap-2 rounded-[14px] border border-dashed border-line px-3.5',
        'text-left text-[13.5px] text-faint transition-colors duration-150 ease-out',
        'hover:border-brand hover:text-brand',
        className,
      )}
    >
      <Plus size={14} className="shrink-0" />
      {label}
    </button>
  );
}
