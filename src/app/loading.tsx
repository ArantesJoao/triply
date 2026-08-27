import { MapPin, Users } from 'lucide-react';

import { Logo, RouteMark } from '@/components/brand/route-mark';
import { ThemeToggle } from '@/components/theme';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Instant shell while the trips-list page fetches auth + trip data.
 * Static parts (logo, toggle, heading, nav labels) render immediately; only the
 * data-dependent sections shimmer, at the sizes the real page renders them.
 */
export default function TripsLoading() {
  return (
    <div className="min-h-dvh bg-page">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
        <Logo size="sm" />
        <div className="flex-1" />
        <ThemeToggle />
        <span className="rounded-full px-3 py-1.5 text-[13px] text-muted opacity-50">
          Settings
        </span>
        <span className="rounded-full px-3 py-1.5 text-[13px] text-muted opacity-50">
          Sign out
        </span>
      </header>

      {/* ── Body ── */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Your trips</h1>
            {/* "Signed in as …" */}
            <Skeleton className="mt-1.5 h-3.5 w-48 max-w-full" />
          </div>

          {/* New-trip form — visible at every width, like the real one. */}
          <div className="flex items-end gap-2">
            <Skeleton className="h-11 w-52 max-w-full rounded-xl" />
            <Skeleton className="h-11 w-28 rounded-xl" />
          </div>
        </div>

        {/* ── Trip cards ── */}
        <ul className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <li key={i}>
              <div className="flex h-full flex-col justify-between gap-6 rounded-xl border border-line bg-card p-5">
                <div>
                  <Skeleton className="h-5 w-40 max-w-full" />
                  <Skeleton className="mt-1.5 h-3 w-24" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-3 text-muted opacity-40">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} />
                      <Skeleton className="h-3 w-10" />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />
                      <Skeleton className="h-3 w-3" />
                    </span>
                  </span>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-14 flex items-center justify-center gap-4 opacity-60">
          <RouteMark width={110} />
        </div>
      </main>
    </div>
  );
}
