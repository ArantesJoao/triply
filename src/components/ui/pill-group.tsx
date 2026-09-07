'use client';

import { cn } from '@/lib/cn';

/** The segmented control Duration, Day and travel mode all wear. */
export function PillGroup<T extends string | number | null>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-fit flex-wrap items-center gap-1 rounded-full bg-inset p-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              'h-8 rounded-full px-3 font-display text-[11.5px] font-semibold transition-colors',
              selected
                ? 'bg-brand text-brand-contrast'
                : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
