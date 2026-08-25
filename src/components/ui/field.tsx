'use client';

import { forwardRef, useId } from 'react';

import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-[11px] border border-line bg-subtle px-3 text-sm text-ink ' +
  'transition-colors duration-150 ease-out placeholder:text-faint ' +
  'hover:border-line-strong focus:border-brand focus:bg-card';

export const Label = ({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) => (
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

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <div>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <input
        ref={ref}
        id={inputId}
        className={cn(CONTROL, 'h-11', className)}
        {...props}
      />
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </div>
  );
});

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    hint?: string;
  };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, label, hint, id, rows = 3, ...props }, ref) {
    const generated = useId();
    const inputId = id ?? generated;

    return (
      <div>
        {label && <Label htmlFor={inputId}>{label}</Label>}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cn(CONTROL, 'resize-y py-2.5 leading-relaxed', className)}
          {...props}
        />
        {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
      </div>
    );
  },
);

/**
 * A radio group rendered as chips — used for the "Timed day / Plain list"
 * choice when adding a column.
 */
export function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; description?: string }[];
  hint?: string;
}) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-[11px] border px-3.5 py-2.5 text-left text-[13px] transition-colors duration-150 ease-out',
                selected
                  ? 'border-brand bg-brand-soft text-brand-on-soft'
                  : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink',
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <span
                  className={cn(
                    'grid size-3.5 shrink-0 place-items-center rounded-full border',
                    selected ? 'border-brand' : 'border-line-strong',
                  )}
                >
                  {/* Selection is never signalled by colour alone. */}
                  {selected && (
                    <span className="size-1.5 rounded-full bg-brand" />
                  )}
                </span>
                {option.label}
              </span>
              {option.description && (
                <span className="mt-1 block pl-5.5 text-xs text-faint">
                  {option.description}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </div>
  );
}
