'use client';

import { Check, ChevronRight, Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const MCP_URL = 'https://planwithtriply.com/api/mcp';

const ADD_COMMAND = `claude mcp add --transport http triply ${MCP_URL}`;

const TOKEN_COMMAND = `claude mcp add --transport http triply ${MCP_URL} \
  --header "Authorization: Bearer YOUR_TOKEN"`;

type Client = 'code' | 'desktop';

const TABS: { id: Client; label: string }[] = [
  { id: 'code', label: 'Claude Code' },
  { id: 'desktop', label: 'Claude Desktop & web' },
];

/**
 * Setup instructions for the MCP server, kept deliberately literal: the things
 * to do, in order, with everything to paste ready to copy. The API docs explain
 * what the tools are — this only has to get someone connected.
 *
 * Since the server became its own OAuth provider there is nothing secret to
 * handle here: the URL is the whole configuration, and the sign-in happens in
 * a browser like every other sign-in. The API-token route still works and is
 * still documented, but it is the fallback now, folded away at the bottom.
 *
 * The two clients want genuinely different things — one terminal command
 * versus a connector dialog — so each gets its own tab rather than one list of
 * steps with the other client's asides threaded through it.
 */
export function McpSetup() {
  const [client, setClient] = useState<Client>('code');

  return (
    <section className="rounded-xl border border-line bg-card">
      <header className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Sparkles size={17} className="text-brand" />
          Connect Claude
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Let Claude read and edit your boards directly — &ldquo;add these five
          places to Barcelona Friday&rdquo; instead of you typing them in. It
          signs in with Google, the way you did; there is no key to copy.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Where you're connecting from"
        className="flex gap-5 border-b border-line px-5"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`mcp-tab-${tab.id}`}
            aria-selected={client === tab.id}
            aria-controls={`mcp-panel-${tab.id}`}
            onClick={() => setClient(tab.id)}
            className={cn(
              '-mb-px border-b-2 py-2.5 font-display text-[13px] font-semibold',
              'transition-colors duration-150 ease-out',
              client === tab.id
                ? 'border-brand text-ink'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {client === 'code' ? (
        <Panel id="code">
          <ol className="flex flex-col gap-5 px-5 py-4">
            <Step n={1} title="Add the server">
              In a terminal, run:
              <CopyBlock text={ADD_COMMAND} />
            </Step>

            <Step n={2} title="Sign in">
              Run <C>/mcp</C> inside Claude Code, pick <C>triply</C>, and choose{' '}
              <b className="font-semibold text-ink">Authenticate</b>. A browser
              opens on trip.ly — press{' '}
              <b className="font-semibold text-ink">Allow access</b> and you can
              close the tab.
            </Step>

            <Step n={3} title="Try it">
              <C>/mcp</C> should now show <C>triply</C> as connected. Then just
              ask — try{' '}
              <i>&ldquo;what&apos;s on my London board?&rdquo;</i>
            </Step>
          </ol>
        </Panel>
      ) : (
        <Panel id="desktop">
          <ol className="flex flex-col gap-5 px-5 py-4">
            <Step n={1} title="Add it as a custom connector">
              Open{' '}
              <b className="font-semibold text-ink">
                Settings → Connectors → Add custom connector
              </b>
              . Name it <i>trip.ly</i> and paste this as the remote MCP server
              URL:
              <CopyBlock text={MCP_URL} />
              Leave every other field alone — no token, no headers.
            </Step>

            <Step n={2} title="Sign in">
              Press <b className="font-semibold text-ink">Add</b> and Claude
              sends you to trip.ly. Sign in if you are not already, then press{' '}
              <b className="font-semibold text-ink">Allow access</b>.
            </Step>

            <Step n={3} title="Turn it on in a chat">
              Open the <C>+</C> menu in the message box, then{' '}
              <b className="font-semibold text-ink">Connectors</b>, and switch{' '}
              <i>trip.ly</i> on. Then just ask — try{' '}
              <i>&ldquo;what&apos;s on my London board?&rdquo;</i>
            </Step>
          </ol>
        </Panel>
      )}

      <Fallback />

      <div className="border-t border-line px-5 py-4">
        <p className="text-[13px] leading-relaxed text-muted">
          <b className="font-semibold text-ink">Another client?</b> Anything
          that speaks streamable HTTP MCP needs only the URL — the rest is
          discovered from it.
        </p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
          <dt className="text-faint">URL</dt>
          <dd className="font-mono break-all">{MCP_URL}</dd>
          <dt className="text-faint">Auth</dt>
          <dd>
            OAuth 2.1, PKCE, dynamic client registration — or a bearer token
          </dd>
        </dl>
      </div>
    </section>
  );
}

/**
 * The old token route, kept because it is still the only way in for a script,
 * a cron job, or a client with no browser to open. Collapsed by default so it
 * does not read as a step in the flow above it.
 */
function Fallback() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-line px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left text-[13px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <ChevronRight
          size={15}
          className={cn(
            'shrink-0 transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        Connecting something without a browser?
      </button>

      {open && (
        <div className="mt-3 pl-[21px]">
          <p className="text-[13px] leading-relaxed text-muted">
            A script or a headless client cannot complete a sign-in, so it uses
            an API token instead. Create one under <b className="font-semibold text-ink">API tokens</b> below, then send it as a header —
            for Claude Code that is the same command with the token spliced in
            place of <C>YOUR_TOKEN</C>:
          </p>
          <CopyBlock text={TOKEN_COMMAND} />
        </div>
      )}
    </div>
  );
}

function Panel({ id, children }: { id: Client; children: React.ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`mcp-panel-${id}`}
      aria-labelledby={`mcp-tab-${id}`}
    >
      {children}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-[12px] font-bold text-brand-on-soft">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[13.5px] font-semibold">{title}</p>
        <div className="mt-1 text-[13px] leading-relaxed text-muted">
          {children}
        </div>
      </div>
    </li>
  );
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-2 flex items-start gap-2">
      <pre className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-line bg-[#0F1230] p-3.5 font-mono text-[11.5px] leading-relaxed text-[#D9DCF5]">
        {text}
      </pre>
      <Button
        size="sm"
        variant={copied ? 'primary' : 'secondary'}
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

const C = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-subtle px-1 py-0.5 font-mono text-[12px] text-ink">
    {children}
  </code>
);
