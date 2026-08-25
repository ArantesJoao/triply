import { Logo } from '@/components/brand/route-mark';
import { ThemeToggle } from '@/components/theme';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Instant shell while the trips-list page fetches auth + trip data.
 * Static parts (logo, toggle, heading) render immediately; only the
 * data-dependent sections shimmer.
 */
export default function TripsLoading() {
  return (
    <div className="min-h-dvh bg-page">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
        <Logo size="sm" />
        <div className="flex-1" />
        <ThemeToggle />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </header>

      {/* ── Body ── */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Your trips</h1>
            <Skeleton className="mt-2 h-4 w-44 max-w-full" />
          </div>
          <div className="hidden items-end gap-2 sm:flex">
            <Skeleton className="h-11 w-52 rounded-xl" />
            <Skeleton className="h-11 w-28 rounded-xl" />
          </div>
        </div>

        {/* ── Trip cards ── */}
        <ul className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <li key={i}>
              <div className="flex h-full flex-col justify-between gap-6 rounded-xl border border-line bg-card p-5">
                <div>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-2 h-3.5 w-24" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3.5 w-16" />
                    <Skeleton className="h-3.5 w-8" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
