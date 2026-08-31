import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth, signIn } from '@/auth';
import { Logo, RouteMark } from '@/components/brand/route-mark';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Where to go once signed in. Only ever a path on this origin: `next` comes
 * from the query string, so an absolute or protocol-relative value would make
 * this page an open redirect — one that hands somebody a trip.ly sign-in
 * screen and then drops them on another site.
 */
function safeNext(next: string | undefined) {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/';
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
   * `session.user.id`, not `session.user` — the same test every other page in
   * the app makes, and it has to stay that way.
   *
   * A session can carry a user with no id: `session.user.id` is filled in from
   * the token's `sub` claim, and a token without one leaves it undefined. When
   * this page treated that as signed in, it sent people straight back to the
   * page that had just decided they were signed out, and the two bounced off
   * each other until the browser gave up on a white screen. Requiring the id
   * here ends it — a session that cannot identify anybody gets the sign-in
   * button, which is the one thing that fixes it.
   */
  if (session?.user?.id) redirect(destination);

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <RouteMark width={148} animate />
        </div>

        <Logo withMark={false} size="lg" className="mb-3" />

        <p className="mb-8 text-[14px] leading-relaxed text-balance text-muted">
          A shared trip-planning board. Turn a pile of ideas into a day-by-day
          itinerary, together.
        </p>

        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: destination });
          }}
        >
          <Button type="submit" variant="primary" size="lg" className="w-full">
            <GoogleGlyph />
            Continue with Google
          </Button>
        </form>

        <p className="mt-6 text-[12px] leading-relaxed text-faint">
          You&apos;ll see the trips you own and any you&apos;ve been invited to.
        </p>
      </div>
    </main>
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
