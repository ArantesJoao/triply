'use client';

import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';

import { cn } from '@/lib/cn';

type Variant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'destructive'
  | 'soft';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // Clean, not glossy — no gradients.
  primary:
    'bg-brand text-brand-contrast hover:bg-brand-hover active:bg-brand-active shadow-none',
  secondary:
    'bg-card text-ink border border-line hover:border-line-strong hover:bg-subtle',
  ghost: 'text-muted hover:text-ink hover:bg-subtle',
  soft: 'bg-brand-soft text-brand-on-soft hover:brightness-95 dark:hover:brightness-125',
  // Outlined — the shape a Delete sitting quietly in a footer wants.
  danger:
    'bg-card text-danger border border-danger-border hover:bg-danger-soft',
  // Filled — the confirmation itself, where the destructive act is the
  // primary action of the panel and has to read as one.
  destructive:
    'bg-danger text-brand-contrast border-0 hover:bg-danger hover:brightness-110 active:brightness-95',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = 'secondary',
      size = 'md',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap',
          'transition-[background-color,border-color,color,opacity] duration-150 ease-out',
          'disabled:pointer-events-none disabled:opacity-50',
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {children}
      </button>
    );
  },
);

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required — these buttons never carry a visible text label. */
  label: string;
  variant?: Variant;
  size?: 'sm' | 'md';
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { className, label, variant = 'ghost', size = 'md', children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        title={label}
        aria-label={label}
        className={cn(
          'inline-grid shrink-0 place-items-center rounded-[10px]',
          'transition-colors duration-150 ease-out',
          'disabled:pointer-events-none disabled:opacity-50',
          VARIANTS[variant],
          size === 'sm' ? 'size-7' : 'size-9',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
