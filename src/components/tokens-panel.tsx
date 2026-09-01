'use client';

import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { request } from '@/components/board/store';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

type Token = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export function TokensPanel({ initial }: { initial: Token[] }) {
  const [tokens, setTokens] = useState(initial);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const label = name.trim();
    if (!label || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { token } = await request<{ id: string; token: string }>(
        '/api/tokens',
        { method: 'POST', body: JSON.stringify({ name: label }) },
      );
      setRevealed(token);
      setName('');
      const { tokens: next } = await request<{ tokens: Token[] }>(
        '/api/tokens',
      );
      setTokens(next);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not create the token.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await request(`/api/tokens/${id}`, { method: 'DELETE' });
    setTokens((current) => current.filter((token) => token.id !== id));
  };

  return (
    <section className="rounded-xl border border-line bg-card">
      <header className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <KeyRound size={17} className="text-brand" />
          API tokens
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          For the REST API, and for MCP clients that cannot open a browser to
          sign in. A token acts with your access. It can reach every trip
          you&apos;re a member of, and nothing else.
        </p>
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        {revealed && (
          <div className="rounded-xl border border-brand bg-brand-soft p-3.5">
            <p className="mb-2 text-[12.5px] font-medium text-brand-on-soft">
              Copy this now. It won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-2.5 py-2 font-mono text-[12px]">
                {revealed}
              </code>
              <Button
                size="sm"
                variant={copied ? 'primary' : 'secondary'}
                onClick={async () => {
                  await navigator.clipboard.writeText(revealed);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1800);
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="New token"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void create();
              }}
              placeholder="Claude on my laptop"
            />
          </div>
          <Button
            variant="primary"
            loading={busy}
            disabled={!name.trim()}
            onClick={create}
          >
            <Plus size={16} />
            Create
          </Button>
        </div>

        {error && (
          <p className="rounded-[10px] border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
            {error}
          </p>
        )}

        {tokens.length > 0 && (
          <ul className="divide-y divide-line">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[13.5px] font-semibold">
                    {token.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[11.5px] text-faint">
                    {token.prefix}…{' · '}
                    {token.lastUsedAt
                      ? `last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                      : 'never used'}
                  </p>
                </div>
                <IconButton
                  label={`Revoke ${token.name}`}
                  size="sm"
                  onClick={() => remove(token.id)}
                  className="text-faint hover:text-danger"
                >
                  <Trash2 size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
