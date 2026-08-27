'use client';

import { Check, Link2, Loader2, RefreshCw, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { RouteMark } from '@/components/brand/route-mark';

import { request, useTrip } from './store';

type People = {
  members: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: string;
  }[];
  pending: { email: string }[];
};

/**
 * Invite & share. Two ways in: an email invite that waits for the person's
 * first sign-in, or a link anyone can follow to join.
 */
export function ShareDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const trip = useTrip();

  const [people, setPeople] = useState<People | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState(trip.shareToken);

  const joinUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/join/${shareToken}`;

  const load = async () => {
    try {
      setPeople(await request<People>(`/api/trips/${trip.id}/members`));
    } catch {
      // Non-fatal: the invite form still works without the roster.
    }
  };

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trip.id]);

  const invite = async () => {
    const address = email.trim();
    if (!address || busy) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/api/trips/${trip.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: address }),
      });
      setEmail('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not invite.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Copying failed. Select the link and copy it manually.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite your travel crew"
      description="Anyone with the link can view and contribute to the trip."
      width="lg"
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Invite by email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void invite();
                  }}
                  placeholder="name@gmail.com"
                  disabled={!trip.isOwner}
                />
              </div>
              <Button
                variant="primary"
                loading={busy}
                disabled={!trip.isOwner || !email.trim()}
                onClick={invite}
              >
                <UserPlus size={16} />
                Invite
              </Button>
            </div>
            {!trip.isOwner && (
              <p className="mt-1.5 text-xs text-faint">
                Only the trip owner can invite people.
              </p>
            )}
          </div>
          <RouteMark width={92} className="mt-6 hidden sm:block" />
        </div>

        {error && (
          <p className="rounded-[10px] border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
            {error}
          </p>
        )}

        <div>
          <span className="mb-2 block font-display text-[10px] font-medium tracking-[0.13em] text-faint uppercase">
            Share link
          </span>
          <div className="flex items-center gap-2 rounded-[11px] border border-line bg-subtle px-3 py-2">
            <Link2 size={15} className="shrink-0 text-faint" />
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">
              {joinUrl}
            </span>
            <Button size="sm" variant={copied ? 'soft' : 'secondary'} onClick={copy}>
              {copied ? <Check size={14} /> : null}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
          {trip.isOwner && (
            <button
              type="button"
              onClick={async () => {
                const { shareToken: next } = await request<{
                  shareToken: string;
                }>(`/api/trips/${trip.id}/share`, { method: 'POST' });
                setShareToken(next);
              }}
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-ink"
            >
              <RefreshCw size={12} />
              Reset link (the old one stops working)
            </button>
          )}
        </div>

        <div>
          <span className="mb-2 block font-display text-[10px] font-medium tracking-[0.13em] text-faint uppercase">
            On this trip
          </span>

          {!people ? (
            <div className="flex items-center gap-2 py-3 text-[13px] text-faint">
              <Loader2 size={14} className="animate-spin" />
              Loading…
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {people.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft font-display text-[11px] font-semibold text-brand-on-soft">
                    {member.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      (member.name ?? member.email).slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[13px] font-semibold">
                      {member.name ?? member.email}
                    </span>
                    <span className="block truncate text-[11.5px] text-faint">
                      {member.email}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-[10.5px] text-muted capitalize">
                    {member.role}
                  </span>
                </li>
              ))}

              {people.pending.map((invited) => (
                <li
                  key={invited.email}
                  className="flex items-center gap-3 py-2.5"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-faint">
                    <UserPlus size={13} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                    {invited.email}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-faint">
                    Invited
                  </span>
                  {trip.isOwner && (
                    <button
                      type="button"
                      aria-label={`Withdraw the invitation to ${invited.email}`}
                      onClick={async () => {
                        await request(
                          `/api/trips/${trip.id}/members?email=${encodeURIComponent(invited.email)}`,
                          { method: 'DELETE' },
                        );
                        await load();
                      }}
                      className="text-faint transition-colors hover:text-danger"
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
