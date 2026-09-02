import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Logo } from '@/components/brand/route-mark';
import { ThemeToggle } from '@/components/theme';

export const metadata: Metadata = { title: 'API' };

const ENDPOINTS: {
  group: string;
  note?: string;
  rows: [string, string, string][];
}[] = [
  {
    group: 'Trips',
    rows: [
      ['GET', '/api/trips', 'Every trip you belong to.'],
      ['POST', '/api/trips', 'Create a trip. Body: { title }'],
      ['GET', '/api/trips/:tripId', 'The whole board as nested JSON.'],
      [
        'PATCH',
        '/api/trips/:tripId',
        'Body: { title?, activeCityId?, dayStartMin? }',
      ],
      ['DELETE', '/api/trips/:tripId', 'Owner only.'],
      ['GET', '/api/trips/:tripId/revision', 'Cheap change check for polling.'],
    ],
  },
  {
    group: 'Bulk import',
    note: 'The endpoint that matters most — create whole days in one call.',
    rows: [
      [
        'POST',
        '/api/trips/:tripId/import',
        'Body: { cities: City[], replace?: boolean }. Returns the new board.',
      ],
    ],
  },
  {
    group: 'Cities',
    rows: [
      ['GET', '/api/trips/:tripId/cities', 'All cities with their columns.'],
      [
        'POST',
        '/api/trips/:tripId/cities',
        'Create one. Accepts a bare title or a full nested city.',
      ],
      ['GET', '/api/trips/:tripId/cities/:city', 'By id or handle.'],
      [
        'PATCH',
        '/api/trips/:tripId/cities/:city',
        'Body: { title?, position?, dayStartMin? }',
      ],
      ['DELETE', '/api/trips/:tripId/cities/:city', 'Cascades.'],
    ],
  },
  {
    group: 'Tags',
    note: 'Tags belong to a city — the same name in another city is untouched.',
    rows: [
      [
        'PATCH',
        '/api/trips/:tripId/cities/:city/tags',
        'Body: { tag, name }. 409 if the new name is already used in the city.',
      ],
      [
        'DELETE',
        '/api/trips/:tripId/cities/:city/tags?tag=…',
        'Strip the tag off every card in the city.',
      ],
    ],
  },
  {
    group: 'Columns',
    rows: [
      [
        'POST',
        '/api/trips/:tripId/cities/:city/columns',
        'Body: { title, timed?, date?, items? }',
      ],
      [
        'PATCH',
        '/api/trips/:tripId/columns/:column',
        'Body: { title?, timed?, date?, position? }',
      ],
      [
        'DELETE',
        '/api/trips/:tripId/columns/:column',
        'The "backlog" column is reserved — returns 409.',
      ],
      [
        'POST',
        '/api/trips/:tripId/columns/:column/reorder',
        'Body: { order: string[] }',
      ],
    ],
  },
  {
    group: 'Items',
    rows: [
      [
        'POST',
        '/api/trips/:tripId/columns/:column/items',
        'Body: { title?, time?, dayOffset?, durationMin?, blurb?, tags? }',
      ],
      ['PATCH', '/api/trips/:tripId/items/:itemId', 'Same fields, all optional.'],
      ['DELETE', '/api/trips/:tripId/items/:itemId', ''],
      [
        'POST',
        '/api/trips/:tripId/items/:itemId/move',
        'Body: { columnId, time?, dayOffset?, order? }',
      ],
    ],
  },
  {
    group: 'People',
    rows: [
      ['GET', '/api/trips/:tripId/members', 'Members plus pending invites.'],
      ['POST', '/api/trips/:tripId/members', 'Body: { email }. Owner only.'],
      [
        'DELETE',
        '/api/trips/:tripId/members?userId=… | ?email=…',
        'Remove a member, or withdraw an invite.',
      ],
      ['POST', '/api/trips/:tripId/share', 'Reset the join link. Owner only.'],
    ],
  },
];

const METHOD_TONE: Record<string, string> = {
  GET: 'bg-brand-soft text-brand-on-soft',
  POST: 'bg-brand text-brand-contrast',
  PATCH: 'bg-subtle text-muted',
  DELETE: 'bg-danger-soft text-danger',
};

export default function DocsPage() {
  return (
    <div className="min-h-dvh bg-page">
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
        <Link href="/" aria-label="All trips">
          <Logo size="sm" />
        </Link>
        <div className="flex-1" />
        <ThemeToggle />
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6">
        <div>
          <Link
            href="/settings"
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={15} />
            Settings
          </Link>
          <h1 className="font-display text-3xl font-bold">API</h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">
            Everything the interface can do is reachable here — that&apos;s the
            point of it. Field names and types mirror the board exactly, so a
            plan drafted in a conversation can be posted without a translation
            layer.
          </p>
        </div>

        <Section title="Authentication">
          <p className="text-[13.5px] leading-relaxed text-muted">
            Create a token under{' '}
            <Link href="/settings" className="text-brand underline underline-offset-2">
              Settings
            </Link>{' '}
            and send it as a bearer token. It carries your access — the trips
            you own or were invited to, and nothing more.
          </p>
          <Code>{`curl https://planwithtriply.com/api/trips \\
  -H "Authorization: Bearer triply_…"`}</Code>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            An OAuth access token works everywhere a personal one does — see{' '}
            <C>OAuth</C> below. Either way the caller acts as one person, with
            exactly that person&apos;s access.
          </p>
        </Section>

        <Section title="OAuth">
          <p className="text-[13.5px] leading-relaxed text-muted">
            trip.ly is its own OAuth 2.1 authorization server, so a client can
            connect itself: it registers, opens a browser, and the person
            approves it — nobody handles a credential by hand. Discovery starts
            at the resource metadata, which <C>/api/mcp</C> also names in the{' '}
            <C>WWW-Authenticate</C> header of its 401.
          </p>
          <Code>{`GET  /.well-known/oauth-protected-resource
GET  /.well-known/oauth-authorization-server
POST /api/oauth/register     dynamic client registration (RFC 7591)
GET  /oauth/authorize        consent, then a code
POST /api/oauth/token        authorization_code | refresh_token
POST /api/oauth/revoke       RFC 7009`}</Code>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            PKCE with <C>S256</C> is required, <C>code</C> is the only response
            type, and there is one scope — <C>triply</C> — because there is one
            thing to grant. Connected apps are listed and revocable under{' '}
            <Link
              href="/settings"
              className="text-brand underline underline-offset-2"
            >
              Settings
            </Link>
            .
          </p>
        </Section>

        <Section title="Data model">
          <Code>{`Trip   { id, title, activeCityId, dayStartMin, shareToken, revision, cities[] }
City   { id, key, title, dayStartMin, position, columns[] }
Column { id, key, title, timed, date, position, items[] }
Item   { id, title, time, dayOffset, durationMin, blurb, tags[], position }`}</Code>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
            <li>
              <B>time</B> — 24-hour <C>&quot;HH:MM&quot;</C>, or{' '}
              <C>null</C> when unscheduled. A null time puts the card in the
              day&apos;s unscheduled tray.
            </li>
            <li>
              <B>dayOffset</B> — midnights past the column&apos;s own date. Use{' '}
              <C>1</C> for anything after midnight, so a 00:47 arrival sorts
              after a 19:33 departure instead of before it.
            </li>
            <li>
              <B>durationMin</B> — optional; renders the card as a block rather
              than a point.
            </li>
            <li>
              <B>dayStartMin</B> — minutes past midnight where the day&apos;s
              time axis opens: <C>480</C> is 08:00 and is the default,{' '}
              <C>600</C> is 10:00. On the half hour, <C>0</C>–<C>720</C>. A trip always has one; a city&apos;s
              is <C>null</C> until it overrides the trip&apos;s. Nothing can hide
              behind it — the axis still grows upward to hold an earlier item,
              so it only decides where an empty day begins.
            </li>
            <li>
              <B>key</B> — a stable handle unique within its parent. Cities and
              columns can be addressed by <C>id</C> or <C>key</C>, so{' '}
              <C>/cities/london</C> works. The key <C>backlog</C> is reserved and
              cannot be deleted.
            </li>
          </ul>
        </Section>

        <Section title="Endpoints">
          <div className="flex flex-col gap-7">
            {ENDPOINTS.map((group) => (
              <div key={group.group}>
                <h3 className="font-display text-[15px] font-bold">
                  {group.group}
                </h3>
                {group.note && (
                  <p className="mt-1 text-[12.5px] text-faint">{group.note}</p>
                )}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[34rem] border-collapse text-left">
                    <tbody className="divide-y divide-line">
                      {group.rows.map(([method, path, note]) => (
                        <tr key={`${method}${path}`}>
                          <td className="py-2.5 pr-3 align-top">
                            <span
                              className={`inline-block rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${METHOD_TONE[method]}`}
                            >
                              {method}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 align-top font-mono text-[12px] break-all">
                            {path}
                          </td>
                          <td className="py-2.5 align-top text-[12.5px] text-muted">
                            {note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Importing a day">
          <Code>{`curl -X POST https://planwithtriply.com/api/trips/TRIP_ID/import \\
  -H "Authorization: Bearer triply_…" \\
  -H "content-type: application/json" \\
  -d '{
    "cities": [{
      "title": "Barcelona",
      "columns": [{
        "id": "fri16",
        "title": "Fri 16",
        "timed": true,
        "date": "2026-10-16",
        "items": [
          { "title": "Sagrada Família", "time": "10:00",
            "blurb": "Book the tower slot.", "tags": ["landmark"] },
          { "title": "Dinner in Gràcia", "time": "21:00", "tags": ["food"] }
        ]
      }]
    }]
  }'`}</Code>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Every city gets a Backlog automatically if the payload omits one.
            Pass <C>&quot;replace&quot;: true</C> to clear existing cities first
            — destructive, and off by default.
          </p>
        </Section>

        <Section title="MCP server">
          <p className="text-[13.5px] leading-relaxed text-muted">
            The same operations are exposed as MCP tools at{' '}
            <C>/api/mcp</C>, so Claude can edit the board directly instead of a
            human relaying requests. The URL is the whole configuration — the
            client discovers the OAuth endpoints from it and sends you off to
            sign in. Step-by-step setup is on{' '}
            <Link
              href="/settings"
              className="text-brand underline underline-offset-2"
            >
              Settings
            </Link>
            .
          </p>
          <Code>{`claude mcp add --transport http triply https://planwithtriply.com/api/mcp`}</Code>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Tools: <C>list_trips</C>, <C>get_board</C>, <C>get_city</C>,{' '}
            <C>create_trip</C>, <C>update_trip</C>, <C>delete_trip</C>,{' '}
            <C>set_tag_style</C>, <C>rename_tag</C>, <C>delete_tag</C>,{' '}
            <C>import_cities</C>, <C>create_city</C>,{' '}
            <C>update_city</C>, <C>delete_city</C>, <C>create_column</C>,{' '}
            <C>update_column</C>, <C>delete_column</C>, <C>create_item</C>,{' '}
            <C>create_items</C>, <C>update_item</C>, <C>update_items</C>,{' '}
            <C>move_item</C>, <C>move_items</C>, <C>delete_item</C>,{' '}
            <C>delete_items</C>.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            The plural item tools — <C>create_items</C>, <C>update_items</C>,{' '}
            <C>move_items</C>, <C>delete_items</C> — take an array and do the
            same work as their singular counterparts in one round trip, so an
            agent editing a whole day&apos;s worth of activities doesn&apos;t
            need one call per card.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Arguments are validated against the same schemas as the REST API, so
            a bad time is rejected rather than quietly dropped, and an
            unrecognised argument is an error rather than a no-op. Inviting
            people and rotating the share link stay off the tool surface —
            they&apos;re owner decisions, made in the app.
          </p>
        </Section>

        <Section title="Errors">
          <p className="text-[13.5px] leading-relaxed text-muted">
            Failures return a JSON body with <C>error</C>, <C>message</C> and
            sometimes <C>details</C>. A trip you aren&apos;t a member of returns{' '}
            <C>404</C> rather than <C>403</C>, so the API never confirms that an
            id exists to someone with no access to it.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-[#0F1230] p-4 font-mono text-[11.5px] leading-relaxed text-[#D9DCF5]">
      {children}
    </pre>
  );
}

const B = ({ children }: { children: React.ReactNode }) => (
  <code className="font-mono font-semibold text-ink">{children}</code>
);

const C = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-subtle px-1 py-0.5 font-mono text-[12px]">
    {children}
  </code>
);
