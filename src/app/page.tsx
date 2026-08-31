import { MapPin, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth, signIn, signOut } from '@/auth';
import { Logo, RouteMark } from '@/components/brand/route-mark';
import { LandingPage } from '@/components/marketing/landing-page';
import { ThemeToggle } from '@/components/theme';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { createTrip, listTripsForUser } from '@/server/trips';

export default async function TripsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    async function signInWithGoogle() {
      'use server';
      await signIn('google', { redirectTo: '/' });
    }

    return <LandingPage signInAction={signInWithGoogle} />;
  }

  const trips = await listTripsForUser(session.user.id);

  async function newTrip(formData: FormData) {
    'use server';
    const inner = await auth();
    if (!inner?.user?.id) redirect('/signin');

    const title = String(formData.get('title') ?? '').trim();
    const id = await createTrip(inner.user.id, title || 'Untitled trip');
    redirect(`/t/${id}`);
  }

  return (
    <div className="min-h-dvh bg-page">
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
        <Logo size="sm" />
        <div className="flex-1" />
        <ThemeToggle />
        <Link
          href="/settings"
          className="rounded-full px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-ink"
        >
          Settings
        </Link>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/signin' });
          }}
        >
          <button
            type="submit"
            className="rounded-full px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Your trips</h1>
            <p className="mt-1 text-[13.5px] text-muted">
              Signed in as {session.user.email}
            </p>
          </div>

          <form action={newTrip} className="flex items-end gap-2">
            <label className="sr-only" htmlFor="new-trip">
              Trip name
            </label>
            <input
              id="new-trip"
              name="title"
              placeholder="Europe, October 2026"
              className="h-11 w-52 rounded-xl border border-line bg-card px-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-brand"
            />
            <Button type="submit" variant="primary">
              <Plus size={17} />
              New trip
            </Button>
          </form>
        </div>

        {trips.length === 0 ? (
          <div className="rounded-xl border border-line bg-card">
            <EmptyState
              title="No trips yet"
              body="Start one, then invite the people you're travelling with."
            />
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/t/${trip.id}`}
                  className="group flex h-full flex-col justify-between gap-6 rounded-xl border border-line bg-card p-5 transition-colors hover:border-brand"
                >
                  <div>
                    <h2 className="font-display text-[17px] leading-snug font-bold group-hover:text-brand">
                      {trip.title}
                    </h2>
                    <p className="mt-1.5 text-[12.5px] text-faint">
                      Updated{' '}
                      {new Date(trip.updatedAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-3 text-[12px] text-muted">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-faint" />
                        {trip.cityCount}{' '}
                        {trip.cityCount === 1 ? 'city' : 'cities'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users size={14} className="text-faint" />
                        {trip.memberCount}
                      </span>
                    </span>
                    {trip.isOwner && (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-medium text-brand-on-soft">
                        Owner
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-14 flex items-center justify-center gap-4 opacity-60">
          <RouteMark width={110} />
        </div>
      </main>
    </div>
  );
}
