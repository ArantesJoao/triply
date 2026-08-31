'use client';

import { Plug, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { request } from '@/components/board/store';
import { IconButton } from '@/components/ui/button';

export type Connection = {
  id: string;
  name: string;
  clientUri: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

/**
 * The apps that connected themselves over OAuth, and the one place to throw
 * them out again.
 *
 * Hidden entirely when nobody has connected anything: an empty panel above the
 * setup instructions would read as a step you have to complete, when the row
 * only ever appears as a consequence of following them.
 */
export function ConnectionsPanel({ initial }: { initial: Connection[] }) {
  const [connections, setConnections] = useState(initial);

  if (connections.length === 0) return null;

  const disconnect = async (id: string) => {
    await request(`/api/oauth/connections/${id}`, { method: 'DELETE' });
    setConnections((current) => current.filter((row) => row.id !== id));
  };

  return (
    <section className="rounded-xl border border-line bg-card">
      <header className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Plug size={17} className="text-brand" />
          Connected apps
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Apps you have let into your trips. Disconnecting one locks it out
          immediately — reconnect from the app itself if you change your mind.
        </p>
      </header>

      <ul className="divide-y divide-line px-5">
        {connections.map((connection) => (
          <li key={connection.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[13.5px] font-semibold">
                {connection.name}
              </p>
              <p className="mt-0.5 text-[11.5px] text-faint">
                connected{' '}
                {new Date(connection.createdAt).toLocaleDateString()}
                {' · '}
                {connection.lastUsedAt
                  ? `last used ${new Date(connection.lastUsedAt).toLocaleDateString()}`
                  : 'never used'}
              </p>
            </div>
            <IconButton
              label={`Disconnect ${connection.name}`}
              size="sm"
              onClick={() => disconnect(connection.id)}
              className="text-faint hover:text-danger"
            >
              <Trash2 size={15} />
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
