import { cn } from '@/lib/cn';

/**
 * A shimmer placeholder for content that hasn't loaded yet.
 *
 * Works with the `skeleton-shimmer` keyframes in globals.css — a gradient sweep
 * rather than a plain opacity pulse, which reads as smoother and more
 * intentional on the warm/cool surfaces in our palette.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton rounded-md', className)}
      {...props}
    />
  );
}
