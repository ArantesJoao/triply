'use client';

import { AlignLeft, Building2, Inbox, Smartphone, Users } from 'lucide-react';
import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';

import { Logo } from '@/components/brand/route-mark';
import { cn } from '@/lib/cn';

import { HeroVisual } from './hero-visual';
import { useRevealed, useScrolledPast } from './use-reveal';
import { useTypedReveal } from './use-typed-reveal';

/** Hero entrance stagger: badge → h1 → paragraph → buttons → fine print. */
const HERO_ENTRANCE_DELAYS = [0, 80, 160, 240, 320] as const;
function heroEntrance(delayMs: number) {
  return { animation: `triply-fade-up 420ms var(--ease-out) ${delayMs}ms both` };
}

const PRIMARY_BUTTON =
  'transition-[background-color,transform] duration-[120ms] ease-out hover:-translate-y-px active:translate-y-0';

function revealCls(revealed: boolean) {
  return cn(
    'transition-[opacity,transform] duration-[360ms] ease-out',
    revealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
  );
}

const STEPS = [
  {
    title: 'Plan it in Claude',
    body: 'Connect once with a token from Settings. Then ask in plain language: a single evening, a city, a two-week route.',
  },
  {
    title: 'It writes to the board',
    body: 'Cities, days, times, durations and tags land as real records. Nothing to copy over by hand.',
  },
  {
    title: 'You take it from there',
    body: "Drag a plan to another hour, park what's unconfirmed, send the link to your crew. On a phone, mid-trip.",
  },
] as const;

// Same anatomy as the real board's city switcher (CueStripCityTab in
// components/board/cue-strip.tsx) — this page can't mount that component
// directly since it needs a live board's data context, but the tab itself
// should look, and now click, exactly like the one people actually use.
const CITY_NAMES = ['London', 'Amsterdam', 'Barcelona', 'Edinburgh'] as const;

const FEATURES = [
  {
    icon: AlignLeft,
    title: 'One shared time axis',
    body: '13:00 sits at the same height on every day, so clashes and gaps are visible instead of calculated.',
  },
  {
    icon: Inbox,
    title: 'Room for the unconfirmed',
    body: 'A backlog per city and an unscheduled tray per day. "Kickoff TBC" doesn\'t need a fake time.',
  },
  {
    icon: Users,
    title: 'Everyone edits',
    body: 'Share a link. No roles, no approvals, no feed to scroll. Just the same board for all of you.',
  },
  {
    icon: Smartphone,
    title: 'Made to open mid-trip',
    body: 'One day at a time on a phone, big tap targets, drag and drop that works with a thumb.',
  },
] as const;

/** The "Under the hood" code sample, tokenised so its typewriter reveal can
 *  slice arbitrary styled runs by a single running character count. */
const API_CODE_TOKENS: { text: string; className?: string }[] = [
  { text: 'POST', className: 'text-[#7B7EF7]' },
  { text: ' /api/trips/TRIP_ID/import\n' },
  { text: 'Authorization: Bearer triply_…', className: 'text-faint' },
  { text: '\n\n{ ' },
  { text: '"cities"', className: 'text-[#F8F8FB]' },
  { text: ': [\n    { ' },
  { text: '"title"', className: 'text-[#F8F8FB]' },
  { text: ': ' },
  { text: '"Barcelona"', className: 'text-[#9fd39f]' },
  { text: ',\n      ' },
  { text: '"columns"', className: 'text-[#F8F8FB]' },
  { text: ': [ … ] }\n] }' },
];
const API_CODE_LENGTH = API_CODE_TOKENS.reduce((sum, t) => sum + t.text.length, 0);

function TypedApiCode({ revealed }: { revealed: number }) {
  let consumed = 0;
  return (
    <>
      {API_CODE_TOKENS.map((token, i) => {
        const start = consumed;
        consumed += token.text.length;
        const visible = token.text.slice(0, Math.max(0, revealed - start));
        if (!visible) return null;
        return (
          <span key={i} className={token.className}>
            {visible}
          </span>
        );
      })}
    </>
  );
}

function McpBadge({
  className,
  width = 15,
  height = 15,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <img
      src="/mcp-icon-rounded.svg"
      width={width}
      height={height}
      alt=""
      className={cn('block', className)}
    />
  );
}

export function LandingPage({
  signInAction,
}: {
  signInAction: () => Promise<void>;
}) {
  const { ref: headerSentinelRef, past: headerScrolled } = useScrolledPast<HTMLDivElement>();
  const { ref: howRef, revealed: howRevealed } = useRevealed<HTMLElement>();
  const { ref: citiesRef, revealed: citiesRevealed } = useRevealed<HTMLDivElement>();
  const { ref: featuresRef, revealed: featuresRevealed } = useRevealed<HTMLDivElement>();
  const { ref: apiRef, revealed: apiRevealed } = useRevealed<HTMLDivElement>();
  const [activeCity, setActiveCity] = useState<(typeof CITY_NAMES)[number]>('London');
  const apiCodeRevealed = useTypedReveal(apiRevealed, API_CODE_LENGTH, 14);

  const cityTabsRef = useRef<HTMLDivElement | null>(null);
  const cityTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [cityIndicator, setCityIndicator] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const container = cityTabsRef.current;
      const btn = cityTabRefs.current[CITY_NAMES.indexOf(activeCity)];
      if (!container || !btn) return;
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      setCityIndicator({
        left: btnRect.left - containerRect.left,
        top: btnRect.top - containerRect.top,
        width: btnRect.width,
        height: btnRect.height,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeCity]);

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-page">
      {/* 40px below the top — once scrolled past, the header darkens slightly. */}
      <div
        ref={headerSentinelRef}
        aria-hidden="true"
        className="absolute top-10 left-0 h-px w-px"
      />

      <header
        className={cn(
          'sticky top-0 z-20 border-b backdrop-blur-md transition-colors duration-150',
          headerScrolled ? 'border-line-strong bg-page/95' : 'border-line bg-page/85',
        )}
      >
        <div className="mx-auto flex max-w-[1140px] items-center gap-4 px-5 py-3.5">
          <Logo size="sm" />
          <div className="flex-1" />
          <Link
            href="#start"
            className={cn(
              'inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-xl bg-brand px-4 text-sm font-medium text-brand-contrast hover:bg-brand-hover',
              PRIMARY_BUTTON,
            )}
          >
            Start free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1140px] items-center gap-10 px-5 py-14 sm:gap-14 sm:py-20 [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]">
        <div className="flex min-w-0 flex-col gap-5">
          <span
            className="inline-flex h-8 w-fit items-center gap-2 rounded-full border border-brand-soft bg-brand-soft py-0 pr-3.5 pl-2.5 text-[12.5px] font-semibold text-brand-on-soft opacity-0"
            style={heroEntrance(HERO_ENTRANCE_DELAYS[0])}
          >
            <McpBadge />
            MCP server · works with Claude
          </span>
          <h1
            className="text-pretty font-display text-[33px] leading-[1.05] font-black tracking-[-0.03em] opacity-0 sm:text-[54px]"
            style={heroEntrance(HERO_ENTRANCE_DELAYS[1])}
          >
            See the trip you planned with Claude.
          </h1>
          <p
            className="max-w-[33em] text-pretty text-[15px] leading-relaxed text-muted opacity-0 sm:text-[18px]"
            style={heroEntrance(HERO_ENTRANCE_DELAYS[2])}
          >
            trip.ly is the board your Claude conversation writes to. Ask for a
            day, a city or a whole two-week route, then open it as a real
            itinerary you can drag, retime and share with everyone coming
            along.
          </p>
          <div
            className="flex flex-wrap gap-3 opacity-0"
            style={heroEntrance(HERO_ENTRANCE_DELAYS[3])}
          >
            <Link
              href="#start"
              className={cn(
                'inline-flex h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand px-[22px] text-[15px] font-semibold text-brand-contrast hover:bg-brand-hover',
                PRIMARY_BUTTON,
              )}
            >
              <span className="flex h-[13px] flex-none items-end gap-[3px]">
                <span className="size-[3px] rounded-full bg-white/55" />
                <span className="mb-1 size-[3px] rounded-full bg-white/70" />
                <span className="mb-[7px] size-1 rounded-full bg-white/85" />
                <span className="mb-0.5 size-1 rounded-full bg-white" />
                <span className="size-2 rounded-full bg-white" />
              </span>
              Connect to Claude
            </Link>
            <Link
              href="#how"
              className="inline-flex h-[50px] items-center justify-center whitespace-nowrap rounded-xl border border-line-strong bg-card px-[22px] text-[15px] font-medium text-ink transition-colors duration-[120ms] hover:bg-subtle"
            >
              See how it works
            </Link>
          </div>
          <span
            className="text-[13px] text-faint opacity-0"
            style={heroEntrance(HERO_ENTRANCE_DELAYS[4])}
          >
            Free while we&apos;re getting started · sign in with Google · no
            card
          </span>
        </div>

        <HeroVisual />
      </section>

      {/* How it works */}
      <section
        id="how"
        ref={howRef}
        className="mx-auto grid max-w-[1140px] scroll-mt-20 gap-4 px-5 py-10 sm:py-14 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]"
      >
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className={cn(
              'flex flex-col gap-2.5 rounded-[18px] border border-line bg-card p-6',
              revealCls(howRevealed),
            )}
            style={{ transitionDelay: `${i * 50}ms` }}
          >
            <span className="grid size-[30px] place-items-center rounded-full bg-brand-soft font-display text-[13px] font-bold text-brand-on-soft">
              {i + 1}
            </span>
            <h3 className="mt-1.5 font-display text-[17px] font-bold">
              {step.title}
            </h3>
            <p className="text-pretty text-sm leading-relaxed text-muted">
              {step.body}
            </p>
          </div>
        ))}
      </section>

      {/* Cities */}
      <section
        id="cities"
        className="mx-auto flex max-w-[1140px] scroll-mt-20 flex-col gap-6.5 px-5 py-10 sm:py-14"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[34em] min-w-0 flex-col gap-3">
            <span className="font-display text-[11px] font-bold tracking-[0.16em] text-faint uppercase">
              One trip, every city
            </span>
            <h2 className="text-pretty font-display text-2xl leading-tight font-black tracking-[-0.025em] sm:text-4xl">
              Every city in one board, not one plan per stop.
            </h2>
            <p className="text-pretty text-[14.5px] leading-relaxed text-muted sm:text-base">
              Ask Claude for &ldquo;the Barcelona leg&rdquo; and it goes in
              its own city, with its own days and backlog. Switch with a tab;
              the trip stays one thing you can hand to everyone.
            </p>
          </div>
        </div>

        <div
          ref={(el) => {
            citiesRef.current = el;
            cityTabsRef.current = el;
          }}
          className="relative flex flex-wrap gap-2.5"
        >
          {cityIndicator && (
            <div
              aria-hidden="true"
              className="absolute rounded-xl border border-brand bg-brand-soft transition-[left,top,width,height] duration-300 ease-out"
              style={{
                left: cityIndicator.left,
                top: cityIndicator.top,
                width: cityIndicator.width,
                height: cityIndicator.height,
              }}
            />
          )}
          {CITY_NAMES.map((name, i) => {
            const active = name === activeCity;
            return (
              <button
                key={name}
                ref={(el) => {
                  cityTabRefs.current[i] = el;
                }}
                type="button"
                onClick={() => setActiveCity(name)}
                className={cn(
                  'relative z-10 inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 font-display text-sm font-semibold whitespace-nowrap transition-colors duration-150',
                  active
                    ? 'border-transparent text-brand-on-soft'
                    : 'border-line bg-card text-ink hover:border-line-strong',
                  revealCls(citiesRevealed),
                )}
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <Building2 size={20} className={active ? 'text-brand' : 'text-faint'} />
                {name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Behaves like a real itinerary */}
      <section className="mx-auto flex max-w-[1140px] flex-col gap-5.5 px-5 py-8 sm:py-10">
        <h2 className="font-display text-[22px] font-black tracking-[-0.02em] sm:text-[30px]">
          Behaves like a real itinerary
        </h2>
        <div
          ref={featuresRef}
          className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4"
        >
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className={cn('flex min-w-0 flex-col gap-2', revealCls(featuresRevealed))}
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              <Icon size={20} strokeWidth={1.75} className="text-brand" />
              <h3 className="font-display text-base font-bold">{title}</h3>
              <p className="text-pretty text-[13.5px] leading-relaxed text-muted">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Under the hood */}
      <section
        id="api"
        className="mx-auto max-w-[1140px] scroll-mt-20 px-5 py-10 sm:py-14"
      >
        <div
          ref={apiRef}
          className={cn(
            'grid items-center gap-6 rounded-3xl bg-[#0F1230] p-6 sm:gap-11 sm:p-11 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]',
            revealCls(apiRevealed),
          )}
        >
          <div className="flex min-w-0 flex-col gap-3.5">
            <span className="font-display text-[11px] font-bold tracking-[0.16em] text-[#7B7EF7] uppercase">
              Under the hood
            </span>
            <h2 className="font-display text-2xl leading-[1.15] font-black tracking-[-0.02em] text-[#F8F8FB] sm:text-[30px]">
              An MCP server and a REST API, both documented.
            </h2>
            <p className="text-pretty text-[14.5px] leading-relaxed text-[#B8BCD0]">
              Every board action is exposed as a tool: import in bulk, retime,
              reorder, tag. Mint a token in Settings; it carries exactly your
              access and only its hash is stored.
            </p>
            <Link
              href="/docs"
              className="inline-flex h-11 w-fit items-center rounded-xl border border-white/[.18] px-4.5 text-sm font-medium text-[#F8F8FB] transition-colors duration-[120ms] hover:bg-white/[.06]"
            >
              Read the docs
            </Link>
          </div>
          <div className="min-w-0 overflow-x-auto rounded-2xl border border-white/[.06] bg-[#0a0c22] px-5 py-4.5">
            <pre className="m-0 font-mono text-[12.5px] leading-[1.8] text-[#B8BCD0]">
              <TypedApiCode revealed={apiCodeRevealed} />
              {apiCodeRevealed < API_CODE_LENGTH && (
                <span
                  aria-hidden="true"
                  className="ml-px -mb-[2px] inline-block h-[1em] w-[7px] animate-pulse bg-[#B8BCD0] align-middle"
                />
              )}
            </pre>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        id="start"
        className="mx-auto max-w-[1140px] scroll-mt-20 px-5 py-10 sm:py-14"
      >
        <div className="flex flex-col items-center gap-4.5 rounded-3xl border border-line bg-card p-8 text-center sm:p-16">
          <h2 className="text-pretty font-display text-[26px] leading-tight font-black tracking-[-0.025em] sm:text-4xl">
            Free while we&apos;re getting started.
          </h2>
          <p className="max-w-[36em] text-pretty text-sm leading-relaxed text-muted sm:text-base">
            Every feature, the MCP server included, no limits on trips,
            cities or people. We&apos;ll give plenty of notice before that
            ever changes.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-3">
            <form action={signInAction}>
              <button
                type="submit"
                className={cn(
                  'inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-brand px-6.5 text-base font-semibold text-brand-contrast hover:bg-brand-hover',
                  PRIMARY_BUTTON,
                )}
              >
                <GoogleGlyph />
                Continue with Google
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1140px] flex-wrap items-center gap-4 px-5 pt-6 pb-10">
          <Logo size="sm" />
          <div className="min-w-5 flex-1" />
          <Link href="#how" className="text-[13.5px] text-muted">
            How it works
          </Link>
          <Link href="#api" className="text-[13.5px] text-muted">
            API &amp; MCP
          </Link>
          <span className="text-[13.5px] text-faint">© 2026 trip.ly</span>
        </div>
      </footer>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#FFF"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
        opacity=".9"
      />
      <path
        fill="#FFF"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
        opacity=".75"
      />
      <path
        fill="#FFF"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
        opacity=".6"
      />
      <path
        fill="#FFF"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
        opacity=".85"
      />
    </svg>
  );
}
