'use client';

import { Check, Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const MCP_URL = 'https://planwithtriply.com/api/mcp';

const ADD_COMMAND = `claude mcp add --transport http triply ${MCP_URL} \
  --header "Authorization: Bearer YOUR_TOKEN"`;

/**
 * Fallback for Claude Desktop when the connector dialog has no request-header
 * field: a local stdio server that proxies to ours and attaches the bearer.
 *
 * The header is split across `args` and `env` on purpose. Claude Desktop on
 * Windows doesn't escape spaces inside `args` when it shells out to npx, so
 * `"Authorization: Bearer …"` arrives mangled; keeping the argument space-free
 * and putting the value in the environment sidesteps that on every platform.
 */
const DESKTOP_CONFIG = `{
  "mcpServers": {
    "triply": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${MCP_URL}",
        "--header",
        "Authorization:\${TRIPLY_AUTH}"
      ],
      "env": {
        "TRIPLY_AUTH": "Bearer YOUR_TOKEN"
      }
    }
  }
}`;

type Client = 'code' | 'desktop';

const TABS: { id: Client; label: string }[] = [
  { id: 'code', label: 'Claude Code' },
  { id: 'desktop', label: 'Claude Desktop' },
];

/**
 * Setup instructions for the MCP server, kept deliberately literal: the things
 * to do, in order, with everything to paste ready to copy. The API docs explain
 * what the tools are — this only has to get someone connected.
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
          Give Claude a token and it can read and edit your boards directly —
          &ldquo;add these five places to Barcelona Friday&rdquo; instead of you
          typing them in.
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
            <Step n={1} title="Create a token above">
              Name it after wherever you&apos;re connecting from, press{' '}
              <b className="font-semibold text-ink">Create</b>, and copy it. It
              is shown once.
            </Step>

            <Step n={2} title="Add the server">
              In a terminal, run this with your token pasted in place of{' '}
              <C>YOUR_TOKEN</C>:
              <CopyBlock text={ADD_COMMAND} />
            </Step>

            <Step n={3} title="Check it worked">
              Run <C>claude mcp list</C>. It should show <C>triply</C> as
              connected. Then just ask — try{' '}
              <i>&ldquo;what&apos;s on my London board?&rdquo;</i>
            </Step>
          </ol>
        </Panel>
      ) : (
        <Panel id="desktop">
          <ol className="flex flex-col gap-5 px-5 py-4">
            <Step n={1} title="Create a token above">
              Name it <i>Claude Desktop</i>, press{' '}
              <b className="font-semibold text-ink">Create</b>, and copy it. It
              is shown once.
            </Step>

            <Step n={2} title="Add it as a custom connector">
              In Claude Desktop, open{' '}
              <b className="font-semibold text-ink">
                Settings → Connectors → Add custom connector
              </b>
              . Name it <i>trip.ly</i> and paste this as the remote MCP server
              URL:
              <CopyBlock text={MCP_URL} />
            </Step>

            <Step n={3} title="Give it the token">
              Set <b className="font-semibold text-ink">Authentication</b> to{' '}
              <C>None</C> — the token is the credential, there is no sign-in
              flow. Then open{' '}
              <b className="font-semibold text-ink">Request headers</b>, pick{' '}
              <C>authorization</C>, and enter the value with the scheme in
              front: <C>Bearer YOUR_TOKEN</C>, space included. Press{' '}
              <b className="font-semibold text-ink">Add</b>.
            </Step>

            <Step n={4} title="Turn it on in a chat">
              Open the <C>+</C> menu in the message box, then{' '}
              <b className="font-semibold text-ink">Connectors</b>, and switch{' '}
              <i>trip.ly</i> on. Then just ask — try{' '}
              <i>&ldquo;what&apos;s on my London board?&rdquo;</i>
            </Step>
          </ol>

          <div className="border-t border-line px-5 py-4">
            <p className="text-[13px] leading-relaxed text-muted">
              <b className="font-semibold text-ink">
                No &ldquo;Request headers&rdquo; section?
              </b>{' '}
              It is still being rolled out, so plenty of accounts don&apos;t
              have it yet. Connect through the config file instead — this route
              needs{' '}
              <a
                href="https://nodejs.org"
                target="_blank"
                rel="noreferrer"
                className="text-brand underline underline-offset-2"
              >
                Node
              </a>{' '}
              installed.
            </p>

            <ol className="mt-4 flex flex-col gap-5">
              <Step n={1} title="Open the config file">
                <b className="font-semibold text-ink">
                  Settings → Developer → Edit Config
                </b>{' '}
                opens the folder it lives in. It is{' '}
                <C>%APPDATA%\Claude\claude_desktop_config.json</C> on Windows
                and{' '}
                <C>
                  ~/Library/Application Support/Claude/claude_desktop_config.json
                </C>{' '}
                on macOS.
              </Step>

              <Step n={2} title="Add the server">
                Paste this in, with your token in place of <C>YOUR_TOKEN</C>. If
                the file already has an <C>mcpServers</C> block, add only the{' '}
                <C>triply</C> entry to it.
                <CopyBlock text={DESKTOP_CONFIG} />
              </Step>

              <Step n={3} title="Restart Claude Desktop">
                Quit it completely — closing the window is not enough — and
                reopen. <i>trip.ly</i> then shows up under the <C>+</C>{' '}
                menu&apos;s{' '}
                <b className="font-semibold text-ink">Connectors</b>.
              </Step>
            </ol>
          </div>
        </Panel>
      )}

      <div className="border-t border-line px-5 py-4">
        <p className="text-[13px] leading-relaxed text-muted">
          <b className="font-semibold text-ink">Another client?</b> Anything
          that speaks streamable HTTP MCP needs only these two:
        </p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
          <dt className="text-faint">URL</dt>
          <dd className="font-mono break-all">{MCP_URL}</dd>
          <dt className="text-faint">Header</dt>
          <dd className="font-mono break-all">
            Authorization: Bearer YOUR_TOKEN
          </dd>
        </dl>
      </div>
    </section>
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
