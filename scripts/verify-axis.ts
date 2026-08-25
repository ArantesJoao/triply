/**
 * Browser check for the one behaviour the whole board hangs on: a given time
 * must sit at an identical Y in every timed column.
 *
 * This is the requirement the spec calls "the single most important piece of
 * feedback", so it's asserted against a real rendered layout rather than
 * trusted to the geometry constants.
 *
 *   ENV_FILE=.env.test npx tsx scripts/verify-axis.ts http://localhost:3103
 *
 * Requires a dev server already running against a seeded database.
 */
import './env';

import { eq } from 'drizzle-orm';
import { encode } from 'next-auth/jwt';
import { chromium } from 'playwright';

import { db, trips, users } from '../src/lib/db';

const BASE = process.argv[2] ?? 'http://localhost:3103';
const COOKIE = 'authjs.session-token';

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(
      `  FAIL ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`,
    );
  }
};

async function main() {
  const email = process.env.SEED_OWNER_EMAIL!.toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) throw new Error(`No seeded user for ${email}`);

  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.createdBy, user.id))
    .limit(1);
  if (!trip) throw new Error('No seeded trip');

  // Mint the same JWT session cookie Auth.js would issue, so the board can be
  // loaded without driving a real Google sign-in.
  const sessionToken = await encode({
    token: { sub: user.id, name: user.name, email: user.email },
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE,
    maxAge: 60 * 60,
  });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1000 },
  });
  await context.addCookies([
    {
      name: COOKIE,
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));

  console.log(`\nLoading ${BASE}/t/${trip.id}`);
  const response = await page.goto(`${BASE}/t/${trip.id}`, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });

  check(
    'board page returns 200',
    response?.status() === 200,
    response?.status(),
  );
  await page.waitForSelector('[data-axis-column]', { timeout: 30_000 });
  // Let measurement and lane packing settle.
  await page.waitForTimeout(2500);

  console.log('\nShared time axis');

  const axes = await page.$$eval('[data-axis-column]', (nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        column: node.getAttribute('data-axis-column')!,
        top: Math.round(rect.top * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      };
    }),
  );

  check('every timed day rendered', axes.length === 6, axes.length);

  const tops = new Set(axes.map((a) => a.top));
  const heights = new Set(axes.map((a) => a.height));
  check('all axes start at the same Y', tops.size === 1, [...tops]);
  check('all axes are the same height', heights.size === 1, [...heights]);

  // The real test: the same wall-clock time in different columns.
  const cards = await page.$$eval('[data-axis-column]', (nodes) =>
    nodes.flatMap((node) => {
      const axisTop = node.getBoundingClientRect().top;
      return [...node.querySelectorAll('[data-item-time]')].map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          column: node.getAttribute('data-axis-column')!,
          time: card.getAttribute('data-item-time')!,
          offsetFromAxisTop: Math.round((rect.top - axisTop) * 100) / 100,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top * 100) / 100,
          bottom: Math.round(rect.bottom * 100) / 100,
        };
      });
    }),
  );

  check('cards rendered on the axis', cards.length > 20, cards.length);

  const byTime = new Map<string, number[]>();
  for (const card of cards) {
    byTime.set(card.time, [
      ...(byTime.get(card.time) ?? []),
      card.offsetFromAxisTop,
    ]);
  }

  const shared = [...byTime.entries()].filter(
    ([, offsets]) => offsets.length > 1,
  );
  check(
    'some times appear in more than one column (a real comparison exists)',
    shared.length > 0,
    shared.length,
  );

  for (const [time, offsets] of shared) {
    const spread = Math.max(...offsets) - Math.min(...offsets);
    check(
      `${time} is at the same height in all ${offsets.length} columns it appears in`,
      spread < 0.5,
      { time, offsets },
    );
  }

  console.log('\nCollision — no two cards may overlap');

  const byColumn = new Map<string, typeof cards>();
  for (const card of cards) {
    byColumn.set(card.column, [...(byColumn.get(card.column) ?? []), card]);
  }

  let overlaps = 0;
  for (const [column, list] of byColumn) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const verticallyApart =
          a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5;
        const horizontallyApart =
          a.right <= b.left + 0.5 || b.right <= a.left + 0.5;
        if (!verticallyApart && !horizontallyApart) {
          overlaps += 1;
          console.log(`       overlap in ${column}: ${a.time} and ${b.time}`);
        }
      }
    }
  }
  check('no card visually overlaps another', overlaps === 0, { overlaps });

  console.log('\nOther');
  check(
    'no console errors',
    errors.length === 0,
    errors.map((e) => e.slice(0, 120)).slice(0, 3),
  );
  check('no hydration mismatch', !errors.some((e) => /hydrat/i.test(e)));

  await page.screenshot({
    path: 'axis-check.png',
    fullPage: false,
  });
  console.log('  screenshot written to axis-check.png');

  await browser.close();

  console.log(
    failures === 0
      ? '\nAxis checks passed.\n'
      : `\n${failures} check(s) failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
