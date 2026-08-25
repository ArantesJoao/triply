import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { RouteMark } from '@/components/brand/route-mark';
import { joinByShareToken } from '@/server/invites';
import { ApiError } from '@/server/errors';

type Props = { params: Promise<{ token: string }> };

/**
 * Redeeming a share link. Signing in first is required so the trip knows who
 * joined; the destination survives the round trip.
 */
export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/signin?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  try {
    const trip = await joinByShareToken(token, session.user.id);
    redirect(`/t/${trip.id}`);
  } catch (error) {
    // `redirect` throws by design — let it through.
    if (!(error instanceof ApiError)) throw error;
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <RouteMark width={120} className="mx-auto mb-6 opacity-50" />
        <h1 className="font-display text-xl font-bold">This link has expired</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          The invite link is no longer valid — it may have been reset. Ask
          whoever shared the trip for a fresh one.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-contrast"
        >
          Go to your trips
        </Link>
      </div>
    </main>
  );
}
