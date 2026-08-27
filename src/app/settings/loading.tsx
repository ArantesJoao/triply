import { ArrowLeft, KeyRound, Plus } from 'lucide-react';
import Link from 'next/link';

import { Logo } from '@/components/brand/route-mark';
import { ThemeToggle } from '@/components/theme';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Instant shell for Settings. The header, nav, section chrome and copy are all
 * static, so they render as themselves; only the user-specific data (avatar,
 * name, email, tokens list) shimmers.
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
            <Skeleton className="h-9 w-20 shrink-0 rounded-xl" />
          </div>
        </section>

        {/* ── API tokens section — mirrors TokensPanel ── */}
        <section className="rounded-xl border border-line bg-card">
          <header className="border-b border-line px-5 py-4">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <KeyRound size={17} className="text-brand" />
              API tokens
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              For the REST API and the MCP server. A token acts with your access
              — it can reach every trip you&apos;re a member of, and nothing
              else.
            </p>
          </header>

          <div className="flex flex-col gap-4 px-5 py-4">
            {/* New-token row */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <span className="mb-2 block font-display text-[10px] font-medium tracking-[0.13em] text-faint uppercase opacity-50">
                  New token
                </span>
                <div className="h-11 rounded-[11px] border border-line bg-subtle" />
              </div>
              <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-brand-contrast opacity-50">
                <Plus size={16} />
                Create
              </span>
            </div>

            {/* Token list */}
            <div className="divide-y divide-line">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-3.5 w-28 max-w-full" />
                    <Skeleton className="mt-1 h-3 w-40 max-w-full" />
                  </div>
                  <Skeleton className="size-7 shrink-0 rounded-[10px]" />
                </div>
              ))}
            </div>
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
