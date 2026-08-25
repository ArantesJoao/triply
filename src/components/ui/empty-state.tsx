import { RouteMark } from '@/components/brand/route-mark';
import { cn } from '@/lib/cn';

/**
 * The shared shape behind every empty state: a light illustration carrying the
 * dotted route, one headline, one short paragraph, one obvious action. Calm and
 * practical — never chirpy.
 */
export function EmptyState({
  title,
  body,
  action,
  secondary,
  illustration,
  size = 'md',
  className,
}: {
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  illustration?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        size === 'md' ? 'gap-4 px-6 py-12' : 'gap-2.5 px-4 py-8',
        className,
      )}
    >
      {illustration ?? <RouteMark width={size === 'md' ? 104 : 76} animate />}

      <div className="max-w-sm">
        <h3
          className={cn(
            'font-display font-bold text-ink',
            size === 'md' ? 'text-lg' : 'text-[13px]',
          )}
        >
          {title}
        </h3>
        {body && (
          <p
            className={cn(
              'mt-1.5 leading-relaxed text-balance text-muted',
              size === 'md' ? 'text-[13px]' : 'text-[11.5px]',
            )}
          >
            {body}
          </p>
        )}
      </div>

      {(action || secondary) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

/**
 * A pale abstract cityscape behind the route — used for a city with nothing
 * planned. Deliberately generic: the brand must not depend on per-city artwork.
 */
export function CityIllustration({ className }: { className?: string }) {
  return (
    <div className={cn('relative h-28 w-56', className)}>
      <svg
        viewBox="0 0 224 112"
        fill="none"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <g className="text-brand" opacity="0.13" fill="currentColor">
          <rect x="14" y="62" width="26" height="46" rx="3" />
          <rect x="46" y="44" width="20" height="64" rx="3" />
          <path d="M72 108V54l14-12 14 12v54z" />
          <rect x="106" y="66" width="30" height="42" rx="3" />
          <rect x="142" y="38" width="16" height="70" rx="3" />
          <circle cx="150" cy="30" r="7" />
          <rect x="164" y="72" width="34" height="36" rx="3" />
        </g>
        <g className="text-brand" opacity="0.2" fill="currentColor">
          <circle cx="30" cy="24" r="2" />
          <circle cx="196" cy="18" r="2.5" />
          <circle cx="120" cy="14" r="1.8" />
        </g>
        <line
          x1="0"
          y1="108"
          x2="224"
          y2="108"
          className="text-brand"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1.5"
        />
      </svg>
      <RouteMark
        width={132}
        className="absolute top-3 right-1"
        animate
      />
    </div>
  );
}

/** An open box with ideas floating out — the empty Backlog. */
export function BacklogIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 116"
      fill="none"
      aria-hidden="true"
      className={cn('h-24 w-44', className)}
    >
      <g className="text-brand">
        <path
          d="M28 74l30-13 30 13-30 13z"
          fill="currentColor"
          opacity="0.18"
        />
        <path d="M28 74v18l30 13V87z" fill="currentColor" opacity="0.26" />
        <path d="M88 74v18L58 105V87z" fill="currentColor" opacity="0.14" />

        <g opacity="0.5">
          <rect
            x="74"
            y="16"
            width="34"
            height="28"
            rx="7"
            fill="currentColor"
            opacity="0.14"
          />
          <rect
            x="116"
            y="34"
            width="34"
            height="28"
            rx="7"
            fill="currentColor"
            opacity="0.14"
          />
          <rect
            x="150"
            y="8"
            width="34"
            height="28"
            rx="7"
            fill="currentColor"
            opacity="0.14"
          />
        </g>

        <g fill="currentColor">
          <circle cx="66" cy="60" r="2" opacity="0.5" />
          <circle cx="78" cy="54" r="2.3" opacity="0.62" />
          <circle cx="92" cy="52" r="2.6" opacity="0.74" />
          <circle cx="106" cy="56" r="2.8" opacity="0.84" />
          <circle cx="120" cy="52" r="3" opacity="0.92" />
          <circle cx="136" cy="44" r="3.2" />
          <circle cx="156" cy="34" r="5.5" />
        </g>
      </g>
    </svg>
  );
}
