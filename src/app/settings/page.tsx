import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth, signOut } from '@/auth';
import { Logo } from '@/components/brand/route-mark';
import { McpSetup } from '@/components/mcp-setup';
import { ThemeToggle } from '@/components/theme';
import { TokensPanel } from '@/components/tokens-panel';
import { listTokens } from '@/server/tokens';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const tokens = await listTokens(session.user.id);

  return (
    <div className="min-h-dvh bg-page">
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
        <Link href="/" aria-label="All trips">
          <Logo size="sm" />
        </Link>
        <div className="flex-1" />
        <ThemeToggle />
      </header>

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

        <section className="rounded-xl border border-line bg-card px-5 py-4">
          <h2 className="font-display text-base font-bold">Account</h2>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft font-display text-[13px] font-semibold text-brand-on-soft">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                (session.user.name ?? session.user.email ?? '?')
                  .slice(0, 2)
                  .toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[14px] font-semibold">
                {session.user.name}
              </p>
              <p className="truncate text-[12.5px] text-faint">
                {session.user.email}
              </p>
            </div>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/signin' });
              }}
            >
              <button
                type="submit"
                className="rounded-xl border border-line px-3 py-2 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </section>

        <TokensPanel
          initial={tokens.map((token) => ({
            ...token,
            lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
            createdAt: token.createdAt.toISOString(),
          }))}
        />

        <McpSetup />

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
