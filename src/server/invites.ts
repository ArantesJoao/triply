import { and, eq, inArray } from 'drizzle-orm';

import { db, tripInvites, tripMembers, trips, users } from '@/lib/db';
import { newInviteId } from '@/lib/ids';

import { conflict, forbidden, notFound } from './errors';

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

/**
 * Converts every invitation addressed to `email` into a real membership.
 * Called on each sign-in — cheap when there's nothing pending, and it means an
 * invite works whether or not the invitee had an account when it was sent.
 */
export async function claimPendingInvites(userId: string, email: string) {
  const address = normaliseEmail(email);

  await db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(tripInvites)
      .where(eq(tripInvites.email, address));

    if (pending.length === 0) return;

    await tx
      .insert(tripMembers)
      .values(
        pending.map((invite) => ({
          tripId: invite.tripId,
          userId,
          role: 'editor' as const,
        })),
      )
      .onConflictDoNothing();

    await tx.delete(tripInvites).where(
      inArray(
        tripInvites.id,
        pending.map((invite) => invite.id),
      ),
    );
  });
}

/**
 * Invites someone by email. If they already have an account they become a
 * member immediately; otherwise a pending invite waits for their first sign-in.
 */
export async function inviteToTrip(
  tripId: string,
  email: string,
  invitedBy: string,
) {
  const address = normaliseEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    throw conflict(`"${email}" doesn't look like an email address.`);
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, address))
    .limit(1);

  if (existing) {
    await db
      .insert(tripMembers)
      .values({ tripId, userId: existing.id, role: 'editor' })
      .onConflictDoNothing();
    return { status: 'member' as const, email: address };
  }

  await db
    .insert(tripInvites)
    .values({ id: newInviteId(), tripId, email: address, invitedBy })
    .onConflictDoNothing();
  return { status: 'invited' as const, email: address };
}

export async function revokeInvite(tripId: string, email: string) {
  await db
    .delete(tripInvites)
    .where(
      and(
        eq(tripInvites.tripId, tripId),
        eq(tripInvites.email, normaliseEmail(email)),
      ),
    );
}

export async function removeMember(tripId: string, userId: string) {
  const [trip] = await db
    .select({ createdBy: trips.createdBy })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (trip?.createdBy === userId) {
    throw conflict(
      "The trip's owner can't be removed. Transfer or delete the trip instead.",
    );
  }

  await db
    .delete(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
}

/** Everyone on a trip, plus invitations that haven't been claimed yet. */
export async function listTripPeople(tripId: string) {
  const [members, pending] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: tripMembers.role,
        joinedAt: tripMembers.createdAt,
      })
      .from(tripMembers)
      .innerJoin(users, eq(users.id, tripMembers.userId))
      .where(eq(tripMembers.tripId, tripId))
      .orderBy(tripMembers.createdAt),
    db
      .select({ email: tripInvites.email, invitedAt: tripInvites.createdAt })
      .from(tripInvites)
      .where(eq(tripInvites.tripId, tripId))
      .orderBy(tripInvites.createdAt),
  ]);

  return { members, pending };
}

/**
 * Redeems a /join/<token> link. Idempotent — following the link again when you
 * are already a member is a no-op rather than an error.
 */
export async function joinByShareToken(shareToken: string, userId: string) {
  const [trip] = await db
    .select({ id: trips.id, title: trips.title })
    .from(trips)
    .where(eq(trips.shareToken, shareToken))
    .limit(1);

  if (!trip) throw notFound('Invite link');

  await db
    .insert(tripMembers)
    .values({ tripId: trip.id, userId, role: 'editor' })
    .onConflictDoNothing();

  return trip;
}

/** Only the trip's creator may manage people or delete the trip. */
export async function assertOwner(tripId: string, userId: string) {
  const [trip] = await db
    .select({ createdBy: trips.createdBy })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!trip) throw notFound('Trip');
  if (trip.createdBy !== userId) {
    throw forbidden('Only the trip owner can do that.');
  }
}
