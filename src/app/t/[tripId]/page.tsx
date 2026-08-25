import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { BoardApp } from '@/components/board/board-app';
import { requireTripAccess } from '@/server/access';
import { getBoard } from '@/server/board';
import { ApiError } from '@/server/errors';

type Props = { params: Promise<{ tripId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tripId } = await params;
  const session = await auth();
  if (!session?.user?.id) return { title: 'Board' };

  try {
    await requireTripAccess(tripId, { userId: session.user.id, via: 'session' });
    const board = await getBoard(tripId);
    return { title: board.title };
  } catch {
    return { title: 'Board' };
  }
}

export default async function BoardPage({ params }: Props) {
  const { tripId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/signin?next=${encodeURIComponent(`/t/${tripId}`)}`);
  }

  let isOwner = false;
  try {
    const access = await requireTripAccess(tripId, {
      userId: session.user.id,
      via: 'session',
    });
    isOwner = access.isOwner;
  } catch (error) {
    // Membership failures read as 404 — the board simply isn't yours.
    if (error instanceof ApiError) notFound();
    throw error;
  }

  const board = await getBoard(tripId);

  return (
    <BoardApp
      board={{ ...board, isOwner }}
      user={{
        name: session.user.name ?? session.user.email ?? 'You',
        image: session.user.image ?? null,
      }}
    />
  );
}
