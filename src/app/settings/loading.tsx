import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Logo } from '@/components/brand/route-mark';
import { ThemeToggle } from '@/components/theme';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Instant shell for Settings. The header, nav and section headings are static;
 * only the user-specific data (avatar, email, tokens list) shimmers.
 */
export default function SettingsLoading() {
  return (
    <div className="min-h-dvh bg-page">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
        <Link href="/" aria-label="All trips">
          <Logo size="sm" />
        </Link>
        <div className="flex-1" />
        <ThemeToggle />
      </header>

      {/* ── Body ── */}
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div>
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={15} />
            Back to trips
          </Link>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
        </div>

        {/* ── Account section ── */}
        <section className="rounded-xl border border-line bg-card px-5 py-4">
          <h2 className="font-display text-base font-bold">Account</h2>
          <div className="mt-3 flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="mt-1.5 h-3.5 w-44 max-w-full" />
            </div>
            <Skeleton className="h-9 w-20 rounded-xl" />
          </div>
        </section>

        {/* ── API tokens section ── */}
        <section className="rounded-xl border border-line bg-card px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold">API tokens</h2>
              <Skeleton className="mt-1.5 h-3.5 w-56 max-w-full" />
            </div>
            <Skeleton className="h-9 w-28 rounded-[10px]" />
          </div>
          <div className="mt-4 divide-y divide-line">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-1.5 h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="size-7 rounded-[10px]" />
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-[13px] text-muted">
          Building against the API?{' '}
          <Link href="/docs" className="text-brand underline underline-offset-2">
            Read the docs
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
