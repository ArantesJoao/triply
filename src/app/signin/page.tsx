import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth, signIn } from '@/auth';
import { Logo, RouteMark } from '@/components/brand/route-mark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Where to go once signed in. Only ever a path on this origin: `next` comes
 * from the query string, so an absolute or protocol-relative value would make
 * this page an open redirect, one that hands somebody a trip.ly sign-in screen
 * and then drops them on another site.
 */
function safeNext(next: string | undefined) {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/**
 * What to say at the top, given where the person was heading.
 *
 * Almost nobody opens this page on purpose. They were sent here from an
 * invite, a board link, or a client asking to connect, and a generic
 * "Welcome back" makes them wonder whether the thing they clicked worked.
 * Naming the destination is the difference between a detour and a dead end.
 */
function contextFor(destination: string) {
  if (destination.startsWith('/oauth/authorize')) {
    return {
      eyebrow: 'Connecting an app',
      title: 'An app is asking for your boards.',
      body: 'Sign in first. Nothing is granted until you approve it.',
    };
  }

  if (destination.startsWith('/join/')) {
    return {
      eyebrow: 'You were invited',
      title: 'Join the trip.',
      body: 'Sign in and the board is yours to edit.',
    };
  }

  if (destination.startsWith('/t/')) {
    return {
      eyebrow: 'Shared board',
      title: 'Sign in to open it.',
      body: 'Boards are only visible to the people on them.',
    };
  }

  if (destination.startsWith('/settings')) {
    return {
      eyebrow: null,
      title: 'Sign in for your settings.',
      body: 'Connected apps, API tokens and your account.',
    };
  }

  return {
    eyebrow: null,
    title: 'One board for the whole trip.',
    body: 'Ask Claude for a city. Drag it into shape. Send the link.',
  };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  const { next } = await searchParams;
  const destination = safeNext(next);

  /*
   * `session.user.id`, not `session.user`, the same test every other page in
   * the app makes, and it has to stay that way.
   *
   * A session can carry a user with no id: `session.user.id` is filled in from
   * the token's `sub` claim, and a token without one leaves it undefined. When
   * this page treated that as signed in, it sent people straight back to the
   * page that had just decided they were signed out, and the two bounced off
   * each other until the browser gave up on a white screen. Requiring the id
   * here ends it. A session that cannot identify anybody gets the sign-in
   * button, which is the one thing that fixes it.
   */
  if (session?.user?.id) redirect(destination);

  const { eyebrow, title, body } = contextFor(destination);

  return (
    <main className="grid min-h-dvh bg-page lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Sign-in column. The only thing on small screens. */}
      <div className="flex min-w-0 flex-col px-6 py-8 sm:px-10 lg:py-10">
        <Link href="/" aria-label="trip.ly home" className="w-fit">
          <Logo size="sm" />
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[368px]">
            <RouteMark width={112} animate className="mb-7" />

            {eyebrow && (
              <span className="mb-3 inline-flex h-7 items-center rounded-full bg-brand-soft px-3 font-display text-[11.5px] font-bold tracking-[0.04em] text-brand-on-soft uppercase">
                {eyebrow}
              </span>
            )}

            <h1 className="text-pretty font-display text-[30px] leading-[1.1] font-black tracking-[-0.025em] sm:text-[34px]">
              {title}
            </h1>

            <p className="mt-3.5 text-pretty text-[14.5px] leading-relaxed text-muted">
              {body}
            </p>

            <form
              className="mt-8"
              action={async () => {
                'use server';
                await signIn('google', { redirectTo: destination });
              }}
            >
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full transition-transform duration-[120ms] ease-out hover:-translate-y-px active:translate-y-0"
              >
                <GoogleGlyph />
                Continue with Google
              </Button>
            </form>

            {/* Same dot-separated fine print the landing page signs off with. */}
            <p className="mt-5 text-[12.5px] leading-relaxed text-faint">
              Free while we&apos;re getting started · no card · name and email
              only
            </p>
          </div>
        </div>

        <p className="text-[12px] text-faint">
          Building against the API?{' '}
          <Link
            href="/docs"
            className="text-brand underline underline-offset-2"
          >
            Read the docs
          </Link>
          .
        </p>
      </div>

      {/* Showcase. Decorative, so it is dropped entirely below lg. */}
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-[#0F1230] lg:block"
      >
        <div
          className="pointer-events-none absolute -top-32 -right-24 size-[420px] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, var(--brand) 0%, transparent 70%)',
          }}
        />

        {/*
          A picture of the product, not the product. `cursor-default` and
          `select-none` stop the I-beam and the drag-select that make a still
          look like something you can type into or move.
        */}
        <div className="relative flex h-full cursor-default flex-col justify-center gap-8 px-12 py-14 select-none xl:px-16">
          <BoardPreview />

          {/*
            The product's own line rather than a testimonial. An invented
            quote on a sign-in page is a claim we cannot back.
          */}
          <div className="max-w-[28em]">
            <p className="font-display text-[19px] leading-snug font-bold text-[#F8F8FB]">
              One shared time axis.
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#8A8FA3]">
              13:00 sits at the same height on every day. Clashes and gaps are
              visible, not calculated.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}

const PREVIEW_ITEMS = [
  { time: '09:00', title: 'Borough Market', tag: 'Food', span: 'h-[52px]' },
  { time: '10:30', title: 'Tate Modern', tag: 'Culture', span: 'h-[76px]' },
  { time: '13:00', title: 'Lunch on the South Bank', tag: null, span: 'h-[52px]' },
] as const;

/**
 * A still of the board, not a working one. Purely decorative, hidden from
 * assistive tech by the `aria-hidden` on the panel around it, and deliberately
 * static: an animated loop beside a sign-in button competes with the one thing
 * the page is asking somebody to do.
 */
function BoardPreview() {
  return (
    <div className="w-full max-w-[440px] rounded-[18px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      <div className="mb-3.5 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-[#7B7EF7]" />
        <span className="font-display text-[13px] font-bold text-[#F8F8FB]">
          Sun 11
        </span>
        <span className="text-[12px] text-[#8A8FA3]">London</span>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-[#B8BCD0]">
          3 plans
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {PREVIEW_ITEMS.map((item) => (
          <div key={item.title} className="flex gap-3">
            <span className="w-9 shrink-0 pt-1 text-right font-mono text-[10.5px] text-[#8A8FA3]">
              {item.time}
            </span>
            <div
              className={cn(
                'flex-1 rounded-[10px] border-l-2 border-[#7B7EF7] bg-white/[0.06] px-3 py-2',
                item.span,
              )}
            >
              <p className="text-[13px] leading-tight font-medium text-[#F8F8FB]">
                {item.title}
              </p>
              {item.tag && (
                <span className="mt-1.5 inline-block rounded-full bg-[#7B7EF7]/20 px-2 py-0.5 text-[10.5px] text-[#B9BBFF]">
                  {item.tag}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        <p className="mb-2 font-display text-[10px] font-bold tracking-[0.14em] text-[#8A8FA3] uppercase">
          Unscheduled
        </p>
        <div className="rounded-[10px] border border-dashed border-white/15 px-3 py-2">
          <p className="text-[12.5px] text-[#B8BCD0]">
            Rooftop bar, if the weather holds
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#FFF"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
        opacity=".9"
      />
      <path
        fill="#FFF"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
        opacity=".75"
      />
      <path
        fill="#FFF"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
        opacity=".6"
      />
      <path
        fill="#FFF"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
        opacity=".85"
      />
    </svg>
  );
}
