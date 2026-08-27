'use client';

import { Check, Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

const MCP_URL = 'https://planwithtriply.com/api/mcp';

const ADD_COMMAND = `claude mcp add --transport http triply ${MCP_URL} \
  --header "Authorization: Bearer YOUR_TOKEN"`;

/**
 * Setup instructions for the MCP server, kept deliberately literal: the three
 * things to do, in order, with the command ready to copy. The API docs explain
 * what the tools are — this only has to get someone connected.
 */
export function McpSetup() {
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

      <ol className="flex flex-col gap-5 px-5 py-4">
        <Step n={1} title="Create a token above">
          Name it after wherever you&apos;re connecting from, press{' '}
          <b className="font-semibold text-ink">Create</b>, and copy it. It is
          shown once.
        </Step>

        <Step n={2} title="Add the server">
          In a terminal, run this with your token pasted in place of{' '}
          <C>YOUR_TOKEN</C>:
          <CopyBlock text={ADD_COMMAND} />
        </Step>

        <Step n={3} title="Check it worked">
          Run <C>claude mcp list</C>. It should show{' '}
          <C>triply</C> as connected. Then just ask — try{' '}
          <i>&ldquo;what&apos;s on my London board?&rdquo;</i>
        </Step>
      </ol>

      <div className="border-t border-line px-5 py-4">
        <p className="text-[13px] leading-relaxed text-muted">
          <b className="font-semibold text-ink">Another client?</b> Claude
          Desktop takes the same server under{' '}
          <b className="font-semibold text-ink">
            Settings → Connectors → Add custom connector
          </b>
          . Anything that speaks streamable HTTP MCP needs only these two:
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
