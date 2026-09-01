'use client';

import {
  AlertCircle,
  Check,
  FileJson,
  Loader2,
  Settings,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/brand/route-mark';
import { ThemeToggle } from '@/components/theme';
import { Button } from '@/components/ui/button';
import { InlineText } from '@/components/ui/inline-text';
import { cn } from '@/lib/cn';

import { ImportDialog } from './import-dialog';
import { ShareDialog } from './share-dialog';
import { useSaveStatus, useStore, useTrip } from './store';

export function BoardHeader({ user }: { user: { name: string; image: string | null } }) {
  const trip = useTrip();
  const store = useStore();
  const [sharing, setSharing] = useState(false);
  const [importing, setImporting] = useState(false);

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-card px-4 py-2.5">
        <Link href="/" aria-label="All trips" className="shrink-0">
          <Logo size="sm" />
        </Link>

        <span className="h-5 w-px shrink-0 bg-line" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <InlineText
            value={trip.title}
            onCommit={(title) => title && store.renameTrip(title)}
            ariaLabel="Trip name"
            fitContent
            className="font-display text-[15px] leading-tight font-bold"
          />
        </div>

        <SaveIndicator />

        <Button size="sm" onClick={() => setImporting(true)} className="hidden sm:inline-flex">
          <FileJson size={15} />
          Import
        </Button>

        <Button size="sm" variant="primary" onClick={() => setSharing(true)}>
          <Share2 size={15} />
          <span className="hidden sm:inline">Share</span>
        </Button>

        <ThemeToggle className="hidden md:inline-flex" />

        <Link
          href="/settings"
          aria-label="Settings and API tokens"
          className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-subtle text-faint transition-colors hover:text-ink"
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="size-full object-cover" />
          ) : (
            <Settings size={15} />
          )}
        </Link>
      </header>

      <ShareDialog open={sharing} onClose={() => setSharing(false)} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </>
  );
}

/** Saving… / Saved / a local, recoverable error. Never blocks the board. */
function SaveIndicator() {
  const status = useSaveStatus();
  const store = useStore();
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    if (status.kind !== 'saved') return;
    setFaded(false);
    const timer = window.setTimeout(() => setFaded(true), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (status.kind === 'idle') return null;

  if (status.kind === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-full border border-danger-border bg-danger-soft px-2.5 py-1 text-[11.5px] text-danger">
        <AlertCircle size={13} className="shrink-0" />
        <span className="max-w-40 truncate">{status.message}</span>
        <button
          type="button"
          onClick={status.retry}
          className="font-semibold underline underline-offset-2"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => store.dismissError()}
          aria-label="Dismiss"
          className="opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <span
      className={cn(
        'hidden items-center gap-1.5 text-[11.5px] text-faint transition-opacity duration-500 sm:flex',
        faded ? 'opacity-0' : 'opacity-100',
      )}
    >
      {status.kind === 'saving' ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          Saving…
        </>
      ) : (
        <>
          <Check size={12} />
          Saved
        </>
      )}
    </span>
  );
}
