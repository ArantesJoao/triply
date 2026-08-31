import type { Metadata } from 'next';
import { Check, ShieldCheck } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { Logo } from '@/components/brand/route-mark';
import { Button } from '@/components/ui/button';
import {
  getClient,
  matchesRegisteredUri,
  originFromHeaders,
  type OAuthClient,
} from '@/server/oauth';

export const metadata: Metadata = { title: 'Connect an app' };

/** Nothing here is cacheable — it depends on the session and on query params. */
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

const one = (params: Params, key: string) => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

/**
 * The consent screen: the one human step in the whole flow.
 *
 * Validation runs in the order RFC 6749 section 4.1.2.1 sets out, and the
 * order matters for safety. Until `client_id` and `redirect_uri` are both
 * known good there is nowhere trustworthy to send anyone, so those two
 * failures render here; everything after them goes back to the client as an
 * `error` parameter, which is what a client knows how to recover from.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const clientId = one(params, 'client_id');
  const client = clientId ? await getClient(clientId) : null;

  if (!client) {
    return (
      <Problem
        title="Unknown application"
        detail="The app that sent you here is not registered with trip.ly. Try connecting again from the app itself."
      />
    );
  }

  // A client that registered exactly one place to come back to need not repeat
  // it; with more than one it has to say which, and either way the value has
  // to be one it registered.
  const requested = one(params, 'redirect_uri');
  const redirectUri = requested
    ? client.redirectUris.some((uri) => matchesRegisteredUri(uri, requested))
      ? requested
      : undefined
    : client.redirectUris.length === 1
      ? client.redirectUris[0]
      : undefined;

  if (!redirectUri) {
    return (
      <Problem
        title="That redirect address is not registered"
        detail={`${client.name} asked to be sent back somewhere it did not register. trip.ly will not deliver an authorization code there.`}
      />
    );
  }

  // Rebound now that the guard above has run, because narrowing does not reach
  // inside the closure below.
  const callback = redirectUri;
  const state = one(params, 'state');

  /**
   * Hands the failure back to the client, which is the party that can act on
   * it. Declared rather than assigned so its `never` return tells the compiler
   * that whatever follows a call is unreachable.
   */
  function bounce(error: string, description: string): never {
    const url = new URL(callback);
    url.searchParams.set('error', error);
    url.searchParams.set('error_description', description);
    if (state) url.searchParams.set('state', state);
    redirect(url.toString());
  }

  if (one(params, 'response_type') !== 'code') {
    bounce('unsupported_response_type', 'Only response_type=code is supported.');
  }

  const codeChallenge = one(params, 'code_challenge');
  const method = one(params, 'code_challenge_method');

  if (!codeChallenge || (method && method !== 'S256')) {
    bounce(
      'invalid_request',
      'PKCE is required: send code_challenge with code_challenge_method=S256.',
    );
  }

  // RFC 8707. A code minted here must only be spendable against this server,
  // so a request naming somebody else's resource is refused rather than
  // quietly narrowed.
  const resource = one(params, 'resource') ?? null;
  if (resource) {
    const ours = originFromHeaders(await headers());
    let matches = false;
    try {
      matches = new URL(resource).origin === new URL(ours).origin;
    } catch {
      matches = false;
    }
    if (!matches) {
      bounce('invalid_target', 'That resource is not served by trip.ly.');
    }
  }

  const session = await auth();
  if (!session?.user?.id) {
    // Straight back here afterwards, with every parameter intact, so signing
    // in is a detour rather than a restart.
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') query.set(key, value);
    }
    redirect(`/signin?next=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  return (
    <Consent
      client={client}
      redirectUri={callback}
      codeChallenge={codeChallenge}
      state={state}
      resource={resource}
      email={session.user.email ?? undefined}
    />
  );
}

function Consent({
  client,
  redirectUri,
  codeChallenge,
  state,
  resource,
  email,
}: {
  client: OAuthClient;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  resource: string | null;
  email?: string;
}) {
  return (
    <Shell>
      <div className="mb-6 text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-on-soft">
          <ShieldCheck size={22} />
        </span>
        <h1 className="font-display text-xl font-bold text-balance">
          Connect {client.name} to trip.ly?
        </h1>
        {email && (
          <p className="mt-1.5 text-[13px] text-faint">Signed in as {email}</p>
        )}
      </div>

      <ul className="flex flex-col gap-3 rounded-xl border border-line bg-subtle px-4 py-3.5">
        <Grant>
          Read and edit every trip you own or have been invited to — cities,
          days, activities and tags.
        </Grant>
        <Grant>Create new trips, and delete ones you own.</Grant>
        <Grant>
          Nothing else. It cannot see other people&apos;s trips, or change your
          account.
        </Grant>
      </ul>

      {/*
        A plain form post rather than a server action, so the browser follows a
        real 302 out to the client — including to a loopback or private-scheme
        address, which a client-side navigation would not survive.

        No CSRF token: the session cookie is SameSite=Lax, so a cross-site POST
        arrives without one and /api/oauth/consent rejects it as signed out.
      */}
      <form
        method="post"
        action="/api/oauth/consent"
        className="mt-6 flex flex-col gap-2.5"
      >
        <input type="hidden" name="client_id" value={client.id} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        {state !== undefined && (
          <input type="hidden" name="state" value={state} />
        )}
        {resource !== null && (
          <input type="hidden" name="resource" value={resource} />
        )}

        <Button
          type="submit"
          name="decision"
          value="allow"
          variant="primary"
          size="lg"
          className="w-full"
        >
          Allow access
        </Button>
        <Button
          type="submit"
          name="decision"
          value="deny"
          variant="ghost"
          size="lg"
          className="w-full"
        >
          Cancel
        </Button>
      </form>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-faint">
        You can disconnect {client.name} at any time from{' '}
        <b className="font-semibold text-muted">Settings</b>.
      </p>
    </Shell>
  );
}

function Grant({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
      <Check size={15} className="mt-0.5 shrink-0 text-brand" />
      <span>{children}</span>
    </li>
  );
}

function Problem({ title, detail }: { title: string; detail: string }) {
  return (
    <Shell>
      <h1 className="font-display text-xl font-bold text-balance">{title}</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{detail}</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="md" />
        </div>
        {children}
      </div>
    </main>
  );
}
