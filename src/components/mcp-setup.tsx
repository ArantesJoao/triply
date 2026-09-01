'use client';

import { Check, ChevronRight, Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const MCP_URL = 'https://planwithtriply.com/api/mcp';

const ADD_COMMAND = `claude mcp add --transport http triply ${MCP_URL}`;

const TOKEN_COMMAND = `claude mcp add --transport http triply ${MCP_URL} \
  --header "Authorization: Bearer YOUR_TOKEN"`;

/*
 * Every developer client below wants the same two facts, the URL and "it
 * speaks HTTP", and differs only in the key it spells them with. Kept as
 * literal blocks rather than generated from one shape, because the whole value
 * of this panel is that you can copy what you see without editing it.
 */
const CURSOR_CONFIG = `{
  "mcpServers": {
    "triply": {
      "url": "${MCP_URL}"
    }
  }
}`;

const VSCODE_CONFIG = `{
  "servers": {
    "triply": {
      "type": "http",
      "url": "${MCP_URL}"
    }
  }
}`;

const WINDSURF_CONFIG = `{
  "mcpServers": {
    "triply": {
      "serverUrl": "${MCP_URL}"
    }
  }
}`;

const GEMINI_CONFIG = `{
  "mcpServers": {
    "triply": {
      "httpUrl": "${MCP_URL}"
    }
  }
}`;

type Client = 'claude' | 'chatgpt';

const TABS: { id: Client; label: string }[] = [
  { id: 'claude', label: 'Claude' },
  { id: 'chatgpt', label: 'ChatGPT' },
];

/**
 * Setup instructions for the MCP server, kept deliberately literal: the things
 * to do, in order, with everything to paste ready to copy. The API docs explain
 * what the tools are, this only has to get someone connected.
 *
 * Since the server became its own OAuth provider there is nothing secret to
 * handle here. The URL is the whole configuration, and the sign-in happens in
 * a browser like every other sign-in.
 *
 * The open tabs are the two chat apps you can connect without being a
 * developer, because that is who plans a trip. Everything that needs a
 * terminal or a config file, Claude Code included, is a disclosure below:
 * still here, still complete, but not the first thing a traveller reads.
 */
export function McpSetup() {
  const [client, setClient] = useState<Client>('claude');

  return (
    <section className="rounded-xl border border-line bg-card">
      <header className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Sparkles size={17} className="text-brand" />
          Connect your AI
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Let it read and edit your boards directly. Say &ldquo;add these five
          places to Barcelona Friday&rdquo; instead of typing them in. You sign
          in with Google, the way you did, so there is no key to copy.
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
              'whitespace-nowrap transition-colors duration-150 ease-out',
              client === tab.id
                ? 'border-brand text-ink'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {client === 'claude' ? (
        <Panel id="claude">
          <ol className="flex flex-col gap-5 px-5 py-4">
            <Step n={1} title="Add it as a custom connector">
              In Claude desktop or on the web, open{' '}
              <b className="font-semibold text-ink">
                Settings → Connectors → Add custom connector
              </b>
              . Name it <i>trip.ly</i> and paste this URL:
              <CopyBlock text={MCP_URL} />
              Leave every other field alone. No token, no headers.
            </Step>

            <Step n={2} title="Sign in">
              Press <b className="font-semibold text-ink">Add</b> and Claude
              sends you to trip.ly. Sign in if you are not already, then press{' '}
              <b className="font-semibold text-ink">Allow access</b>.
            </Step>

            <Step n={3} title="Turn it on in a chat">
              Open the <C>+</C> menu in the message box, then{' '}
              <b className="font-semibold text-ink">Connectors</b>, and switch{' '}
              <i>trip.ly</i> on. Then just ask. Try{' '}
              <i>&ldquo;what&apos;s on my London board?&rdquo;</i>
            </Step>
          </ol>
        </Panel>
      ) : (
        <Panel id="chatgpt">
          <ol className="flex flex-col gap-5 px-5 py-4">
            <Step n={1} title="Turn on developer mode">
              On the web, open{' '}
              <b className="font-semibold text-ink">
                Settings → Apps → Advanced settings
              </b>{' '}
              and switch on{' '}
              <b className="font-semibold text-ink">Developer mode</b>. This is
              what lets ChatGPT talk to a server that is not in its own
              directory.
            </Step>

            <Step n={2} title="Add the connector">
              Still under <b className="font-semibold text-ink">Apps</b>, choose{' '}
              <b className="font-semibold text-ink">Add custom connector</b>.
              Name it <i>trip.ly</i> and paste this URL:
              <CopyBlock text={MCP_URL} />
            </Step>

            <Step n={3} title="Sign in">
              ChatGPT sends you to trip.ly. Press{' '}
              <b className="font-semibold text-ink">Allow access</b> and you can
              close the tab.
            </Step>

            <Step n={4} title="Use it in a chat">
              Pick <i>trip.ly</i> from the tools menu in the message box, then
              just ask. Try{' '}
              <i>&ldquo;what&apos;s on my London board?&rdquo;</i>
            </Step>
          </ol>

          <p className="px-5 pb-4 text-[12.5px] leading-relaxed text-faint">
            Custom connectors need a paid plan (Plus, Pro, Business, Enterprise
            or Edu) and the web app. On a Business or Enterprise workspace an
            admin can switch developer mode off for everyone.
          </p>
        </Panel>
      )}

      <div className="border-t border-line px-5 py-5">
        <p className="font-display text-[13px] font-semibold text-ink">
          Somewhere else?
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Any client that speaks streamable HTTP MCP needs only the URL. It
          discovers the sign-in from there and prompts you the first time you
          use it.
        </p>
      </div>

      <Disclosure title="Gemini">
        <P>
          The Gemini app does not take custom MCP connectors yet. It offers
          Google&apos;s own built-in ones only, so there is nowhere to paste
          this URL. Two Google surfaces do take it:
        </P>
        <P>
          <b className="font-semibold text-ink">Gemini CLI.</b> Add the entry to{' '}
          <C>~/.gemini/settings.json</C>, restart, then run <C>/mcp</C> to
          check it connected. Streamable HTTP servers go under <C>httpUrl</C>.
        </P>
        <CopyBlock text={GEMINI_CONFIG} />
        <P>
          <b className="font-semibold text-ink">Gemini Enterprise.</b> An admin
          adds it under custom MCP server connections for the whole workspace.
        </P>
      </Disclosure>

      <Disclosure title="Claude Code (terminal)">
        <P>
          One command, no config file. Run this, then <C>/mcp</C> inside Claude
          Code, pick <C>triply</C>, and choose{' '}
          <b className="font-semibold text-ink">Authenticate</b>. A browser
          opens on trip.ly. Press{' '}
          <b className="font-semibold text-ink">Allow access</b> and you can
          close the tab.
        </P>
        <CopyBlock text={ADD_COMMAND} />
        <P>
          <C>/mcp</C> should then show <C>triply</C> as connected.
        </P>
      </Disclosure>

      <Disclosure title="Cursor">
        <P>
          Open{' '}
          <b className="font-semibold text-ink">
            Settings → Tools &amp; Integrations → New MCP server
          </b>
          , which opens <C>~/.cursor/mcp.json</C>. Add the <C>triply</C> entry:
        </P>
        <CopyBlock text={CURSOR_CONFIG} />
        <P>
          Cursor then shows <i>triply</i> as needing login. Click it, approve on
          trip.ly, and the tools appear. Use <C>.cursor/mcp.json</C> in a
          project instead if you only want it there.
        </P>
      </Disclosure>

      <Disclosure title="VS Code (Copilot agent mode)">
        <P>
          Run <C>MCP: Add Server</C> from the Command Palette, choose{' '}
          <b className="font-semibold text-ink">HTTP</b>, and paste the URL.
          That writes the entry for you. To do it by hand, put this in{' '}
          <C>.vscode/mcp.json</C>:
        </P>
        <CopyBlock text={VSCODE_CONFIG} />
        <P>
          Note the key is <C>servers</C> here, not <C>mcpServers</C>. VS Code
          prompts for sign-in the first time the agent reaches for a tool.
        </P>
      </Disclosure>

      <Disclosure title="Windsurf">
        <P>
          Open{' '}
          <b className="font-semibold text-ink">
            Settings → Cascade → MCP servers → Manage
          </b>
          , or edit <C>~/.codeium/windsurf/mcp_config.json</C> directly:
        </P>
        <CopyBlock text={WINDSURF_CONFIG} />
        <P>
          The key for a remote server is <C>serverUrl</C>, not <C>url</C>. Press
          refresh in the MCP panel afterwards.
        </P>
      </Disclosure>

      <Disclosure title="Connecting something without a browser?">
        <P>
          A script, a cron job, or a headless client cannot complete a sign-in,
          so it uses an API token instead. Create one under{' '}
          <b className="font-semibold text-ink">API tokens</b> below, then send
          it as a header. For Claude Code that is the same command with your
          token in place of <C>YOUR_TOKEN</C>:
        </P>
        <CopyBlock text={TOKEN_COMMAND} />
      </Disclosure>

      <Disclosure title="Writing your own client?">
        <P>
          Two facts are all you need. Everything else is discoverable from the
          401 the endpoint returns.
        </P>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
          <dt className="text-faint">URL</dt>
          <dd className="font-mono break-all">{MCP_URL}</dd>
          <dt className="text-faint">Auth</dt>
          <dd>
            OAuth 2.1 with PKCE and dynamic client registration, or a bearer
            token
          </dd>
        </dl>
        <P>
          The full endpoint list is in the{' '}
          <a href="/docs" className="text-brand underline underline-offset-2">
            API docs
          </a>
          .
        </P>
      </Disclosure>
    </section>
  );
}

/**
 * A collapsed row that opens to reveal one client's setup. Closed by default
 * so the list of them reads as a short index rather than a wall of JSON, and
 * so nothing below the tabs looks like a step you still have to do.
 */
function Disclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-line px-5 py-3.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left font-display text-[13px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <ChevronRight
          size={15}
          className={cn(
            'shrink-0 transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        {title}
      </button>

      {open && <div className="mt-3 pl-[21px]">{children}</div>}
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

/** Body copy inside a disclosure, so the spacing stays even between blocks. */
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[13px] leading-relaxed text-muted [&:not(:first-child)]:mt-3">
    {children}
  </p>
);

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
