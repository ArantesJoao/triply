import { cn } from '@/lib/cn';

/**
 * The trip.ly route mark.
 *
 * Individual dots, no connecting stroke. The path deliberately rises, changes
 * direction, dips, and rises again before landing on a much larger final dot —
 * a route someone actually explored, not a chart trending upward. Flattening
 * it into an even line or a smooth curve loses the whole idea.
 */

type Dot = { x: number; y: number; r: number; o: number };

const DOTS: Dot[] = [
  // Small trail dots, climbing.
  { x: 4, y: 31, r: 2, o: 0.4 },
  { x: 11, y: 25, r: 2.1, o: 0.5 },
  { x: 18, y: 20, r: 2.3, o: 0.58 },
  { x: 25.5, y: 16.5, r: 2.4, o: 0.66 },
  // Direction change, then the dip.
  { x: 33, y: 18.5, r: 2.5, o: 0.72 },
  { x: 39.5, y: 24, r: 2.6, o: 0.78 },
  { x: 46, y: 29.5, r: 2.7, o: 0.84 },
  { x: 53.5, y: 32.5, r: 2.8, o: 0.88 },
  // Rising again toward the destination.
  { x: 61, y: 30.5, r: 2.9, o: 0.92 },
  { x: 68, y: 26, r: 3, o: 0.95 },
  { x: 75, y: 20.5, r: 3.1, o: 0.97 },
  { x: 82.5, y: 14.5, r: 3.2, o: 0.99 },
  { x: 90, y: 9.5, r: 3.3, o: 1 },
  // Destination — noticeably larger, but not a map pin.
  { x: 104, y: 6.5, r: 6.5, o: 1 },
];

export type RouteMarkProps = {
  className?: string;
  /** Rendered width in px; height follows the 120:44 aspect ratio. */
  width?: number;
  /** `brand` uses Periwinkle; `current` inherits the text colour. */
  tone?: 'brand' | 'current';
  /** Fades the trail in once on mount — for empty and loading states only. */
  animate?: boolean;
};

export function RouteMark({
  className,
  width = 120,
  tone = 'brand',
  animate = false,
}: RouteMarkProps) {
  const fill = tone === 'brand' ? 'var(--brand)' : 'currentColor';

  return (
    <svg
      viewBox="0 0 120 44"
      width={width}
      height={(width * 44) / 120}
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {DOTS.map((dot, index) => (
        <circle
          key={index}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
          fill={fill}
          opacity={dot.o}
          style={
            animate
              ? {
                  animation: `triply-route-in 420ms var(--ease-out) both`,
                  animationDelay: `${index * 55}ms`,
                }
              : undefined
          }
        />
      ))}
      {animate && (
        <style>{`@keyframes triply-route-in{from{opacity:0;transform:translateY(3px)}to{opacity:inherit;transform:none}}`}</style>
      )}
    </svg>
  );
}

/** The wordmark: lowercase, `.ly` in Periwinkle. */
export function Logo({
  className,
  withMark = true,
  size = 'md',
}: {
  className?: string;
  withMark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const type = {
    sm: 'text-[17px]',
    md: 'text-[21px]',
    lg: 'text-[28px]',
  }[size];
  const markWidth = { sm: 34, md: 42, lg: 56 }[size];

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {withMark && <RouteMark width={markWidth} />}
      <span
        className={cn(
          'font-display font-bold tracking-[-0.02em] leading-none',
          type,
        )}
      >
        trip<span className="text-brand">.ly</span>
      </span>
    </span>
  );
}
