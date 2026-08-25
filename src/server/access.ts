import { createHash } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { auth } from '@/auth';
import { apiTokens, db, tripMembers, trips } from '@/lib/db';

import { forbidden, notFound, unauthorized } from './errors';

export type Actor = {
  userId: string;
  /** How the caller proved who they are — a browser session or an API token. */
  via: 'session' | 'token';
};

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** The signed-in browser user, if there is one. */
export async function sessionActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { userId: session.user.id, via: 'session' };
}

/**
 * Resolves `Authorization: Bearer triply_…` to the user who owns that token.
 * Google OAuth can't be completed by an agent, so this is how Claude — via
 * REST or MCP — acts on someone's trips, with exactly that person's access.
 */
export async function tokenActor(request: Request): Promise<Actor | null> {
  const header = request.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;

  const presented = header.slice(7).trim();
  if (!presented) return null;

  const [row] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hashToken(presented)))
    .limit(1);

  if (!row) return null;

  // Fire-and-forget: a failed "last used" stamp must never fail the request.
  void db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.id))
    .catch(() => {});

  return { userId: row.userId, via: 'token' };
}

/** Bearer token first so an API call from a logged-in browser still acts as the token. */
export async function requireActor(request: Request): Promise<Actor> {
  const actor = (await tokenActor(request)) ?? (await sessionActor());
  if (!actor) {
    throw unauthorized(
      'Sign in, or send an API token as "Authorization: Bearer triply_…".',
    );
  }
  return actor;
}

export type TripAccess = {
  tripId: string;
  role: string;
  isOwner: boolean;
};

/**
 * Confirms the actor is on the trip. Returns 404 rather than 403 for trips
 * they aren't a member of, so the API doesn't confirm that an id exists to
 * someone who has no business knowing.
 */
export async function requireTripAccess(
  tripId: string,
  actor: Actor,
): Promise<TripAccess> {
  const [row] = await db
    .select({ role: tripMembers.role, createdBy: trips.createdBy })
    .from(trips)
    .leftJoin(
      tripMembers,
      and(eq(tripMembers.tripId, trips.id), eq(tripMembers.userId, actor.userId)),
    )
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!row || row.role == null) throw notFound('Trip');

  return {
    tripId,
    role: row.role,
    isOwner: row.createdBy === actor.userId,
  };
}

export async function requireTripOwner(
  tripId: string,
  actor: Actor,
): Promise<TripAccess> {
  const access = await requireTripAccess(tripId, actor);
  if (!access.isOwner) throw forbidden('Only the trip owner can do that.');
  return access;
}
