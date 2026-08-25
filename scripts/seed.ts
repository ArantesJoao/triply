/**
 * Seeds the real October 2026 trip.
 *
 *   npm run db:push     # create the tables first
 *   npm run seed        # then this
 *
 * Idempotent by title: re-running skips a trip that already exists unless you
 * pass --force, which deletes and recreates it.
 *
 * The owner is SEED_OWNER_EMAIL. That account does not need to have signed in
 * yet — a user row is created for the address and the Google account attaches
 * to it on first sign-in.
 */
import 'dotenv/config';

import { eq } from 'drizzle-orm';

import { db, tripMembers, trips, users } from '../src/lib/db';
import { newShareToken, newTripId } from '../src/lib/ids';
import { importBoard, type CityInput } from '../src/server/board';

const TRIP_TITLE = 'Europe — October 2026';

const london: CityInput = {
  title: 'London',
  key: 'london',
  columns: [
    {
      id: 'thu8',
      title: 'Thu 8',
      timed: true,
      date: '2026-10-08',
      items: [
        {
          title: 'Check-in',
          time: '19:00',
          blurb:
            'Realistically after immigration, bags, and the ride into town.',
          tags: ['logistics'],
        },
        {
          title: 'Dinner & reunion pints',
          time: '20:00',
          blurb:
            "Jet lag's real — keep it low-key, somewhere near where you're staying.",
          tags: ['food', 'pub'],
        },
      ],
    },
    {
      id: 'fri9',
      title: 'Fri 9',
      timed: true,
      date: '2026-10-09',
      items: [
        {
          title: 'Portobello Road Market',
          time: '09:00',
          blurb: 'Antiques, food stalls, colourful streets (Beltra & João).',
          tags: ['market', 'shopping'],
        },
        {
          title: 'Notting Hill streets',
          time: '09:45',
          blurb: 'The famous pastel-coloured houses, good for photos.',
          tags: ['walk', 'landmark'],
        },
        {
          title: 'Hyde Park & Kensington Gardens',
          time: '12:00',
          blurb: 'Walk east through the park toward Buckingham Palace.',
          tags: ['park'],
        },
        {
          title: "Buckingham Palace (exterior) & St James's Park",
          time: '12:45',
          blurb: 'Check the guard-change schedule if you want to catch it.',
          tags: ['landmark', 'park'],
        },
        {
          title: 'Westminster walk',
          time: '14:00',
          blurb: 'Big Ben, Houses of Parliament, Westminster Abbey exterior.',
          tags: ['landmark'],
        },
        {
          title: 'Trafalgar Square',
          time: '15:30',
          blurb: 'Fountains, National Gallery steps, always lively.',
          tags: ['landmark'],
        },
        {
          title: 'Covent Garden',
          time: '16:15',
          blurb: 'Street performers, shops — good spot to sit down.',
          tags: ['shopping', 'landmark'],
        },
        {
          title: 'Last work stretch (Gu & Rato)',
          time: '17:00',
          blurb:
            'Their final business hours of the trip, then everyone regroups.',
          tags: ['logistics'],
        },
        {
          title: 'Carnaby Street & Soho',
          time: '18:00',
          blurb: 'Neon lights, record shops, boutiques.',
          tags: ['shopping'],
        },
        {
          title: 'Chinatown',
          time: '18:45',
          blurb: 'Snack stop, lanterns, lively energy.',
          tags: ['food'],
        },
        {
          title: 'Brick Lane wander',
          time: '19:30',
          blurb: 'Street art, vintage shops, right next to Shoreditch.',
          tags: ['market', 'walk'],
        },
        {
          title: 'Shoreditch or Soho pub crawl',
          time: '20:15',
          blurb: 'First fully free evening for everyone — good pub density.',
          tags: ['pub'],
        },
        {
          title: 'Late spot',
          time: '22:30',
          blurb: "Karaoke or a late bar if the night's still young.",
          tags: ['pub'],
        },
      ],
    },
    {
      id: 'sat10',
      title: 'Sat 10',
      timed: true,
      date: '2026-10-10',
      items: [
        {
          title: 'South Bank riverside walk',
          time: '09:00',
          blurb: 'Westminster Bridge → London Eye, easy morning walk.',
          tags: ['walk', 'landmark'],
        },
        {
          title: 'Borough Market',
          time: '09:45',
          blurb:
            'Home of the viral chocolate-covered strawberries (Turnips stall).',
          tags: ['food', 'market'],
        },
        {
          title: 'Leake Street Graffiti Tunnel',
          time: '10:30',
          blurb: 'Colourful, low-key detour near Waterloo.',
          tags: ['walk'],
        },
        {
          title: "St Paul's Cathedral (exterior) & Millennium Bridge",
          time: '11:15',
          blurb: 'Dome views, walk across to the City side.',
          tags: ['landmark'],
        },
        {
          title: 'Tower Bridge & Tower of London (exterior)',
          time: '12:00',
          blurb: 'Classic view, walk across the bridge.',
          tags: ['landmark'],
        },
        {
          title: 'Sky Garden',
          time: '12:45',
          blurb: 'Free rooftop skyline view — book the slot online in advance.',
          tags: ['landmark'],
        },
        {
          title: 'Spitalfields Market',
          time: '14:00',
          blurb: 'Covered Victorian market, good food stalls.',
          tags: ['market', 'food'],
        },
        {
          title: 'Camden Market',
          time: '15:00',
          blurb: 'Browse the stalls, plenty of food if anyone wants a bite.',
          tags: ['market', 'food'],
        },
        {
          title: "Regent's Canal boat ride to Little Venice",
          time: '16:15',
          blurb: 'Scenic ~45min narrowboat trip from Camden Lock.',
          tags: ['transit', 'park'],
        },
        {
          title: 'Primrose Hill viewpoint',
          time: '17:00',
          blurb:
            'Short walk from Little Venice; best panoramic skyline spot.',
          tags: ['park'],
        },
        {
          title: 'Pub session, Camden/Primrose Hill',
          time: '19:00',
          blurb: 'Wind down — keep it reasonable, big Sunday ahead.',
          tags: ['pub'],
        },
      ],
    },
    {
      id: 'sun11',
      title: 'Sun 11',
      timed: true,
      date: '2026-10-11',
      items: [
        {
          title: 'Train to Liverpool',
          time: '07:41',
          blurb: 'London Euston → Liverpool Lime St, direct, LNER.',
          tags: ['transit'],
        },
        {
          title: 'Liverpool vs Man City',
          time: null,
          blurb: 'Anfield, hospitality tickets — kickoff not yet announced.',
          tags: ['football'],
        },
        {
          title: 'Train back to London',
          time: '19:33',
          blurb:
            'Liverpool Lime St → London Euston, 1 change, arriving 00:47.',
          tags: ['transit'],
          // 19:33 → 00:47 the next morning. Stored as a real duration so the
          // card renders as a block that crosses midnight on the axis rather
          // than a point that looks like it ends the evening.
          durationMin: 314,
        },
      ],
    },
    {
      id: 'mon12',
      title: 'Mon 12',
      timed: true,
      date: '2026-10-12',
      items: [
        {
          title: 'Meet at Piccadilly Circus',
          time: '09:00',
          blurb: 'Start point for the day.',
          tags: ['logistics'],
        },
        {
          title: 'Wembley Stadium (exterior)',
          time: '09:45',
          blurb: 'Quick photo stop, iconic arch.',
          tags: ['football'],
        },
        {
          title: 'Craven Cottage tour (Fulham FC)',
          time: '11:15',
          blurb: "Book this slot first — it's the tightest.",
          tags: ['football'],
        },
        {
          title: 'Lunch',
          time: null,
          blurb: 'Somewhere between Fulham and Stamford Bridge.',
          tags: ['food'],
        },
        {
          title: 'Stamford Bridge tour (Chelsea)',
          time: '14:00',
          blurb: 'Walk over from Fulham.',
          tags: ['football'],
        },
        {
          title: 'Emirates Stadium tour (Arsenal)',
          time: '16:00',
          blurb: 'Check the last entry time.',
          tags: ['football'],
        },
        {
          title: 'Rough Trade East',
          time: '18:00',
          blurb: 'Record shop in Shoreditch.',
          tags: ['shopping'],
        },
        {
          title: 'Dinner',
          time: null,
          blurb: 'Somewhere in Shoreditch before the pub.',
          tags: ['food'],
        },
        {
          title: 'Pint at Howl at the Moon (Hoxton)',
          time: '20:00',
          blurb: '',
          tags: ['pub'],
        },
      ],
    },
    {
      id: 'tue13',
      title: 'Tue 13',
      timed: true,
      date: '2026-10-13',
      items: [
        {
          title: 'Train to Amsterdam',
          time: '06:00',
          blurb: 'Departs London — tight after Monday night.',
          tags: ['transit'],
        },
      ],
    },
    {
      id: 'backlog',
      title: 'Backlog',
      timed: false,
      items: [
        {
          title: 'Tottenham Hotspur Stadium tour',
          time: null,
          blurb: "Cut from Monday's plan — off route.",
          tags: ['football'],
        },
        {
          title: 'Little Venice canal walk (on foot)',
          time: null,
          blurb: 'Alternative to the boat ride.',
          tags: ['walk', 'park'],
        },
        {
          title: 'Greenwich & Cutty Sark',
          time: null,
          blurb: 'Not yet scheduled — riverboat from central London.',
          tags: ['landmark', 'park'],
        },
        {
          title: 'Hampstead Heath',
          time: null,
          blurb: 'Not yet scheduled — views and swimming ponds.',
          tags: ['park'],
        },
        {
          title: 'Kew Gardens',
          time: null,
          blurb: 'Not yet scheduled — a bit further out.',
          tags: ['park'],
        },
        {
          title: 'Columbia Road Flower Market',
          time: null,
          blurb: 'Sundays only, clashes with the Anfield day.',
          tags: ['market'],
        },
      ],
    },
  ],
};

/**
 * The other four start as real placeholders — one empty Backlog, no dummy
 * content — exactly as the spec asks.
 */
const placeholders: CityInput[] = [
  'Amsterdam',
  'Barcelona',
  'Edinburgh',
  'Glasgow',
].map((title) => ({ title, key: title.toLowerCase() }));

async function main() {
  const force = process.argv.includes('--force');
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();

  if (!email || email === 'you@example.com') {
    throw new Error(
      'Set SEED_OWNER_EMAIL in .env.local to the Google address that should own the trip.',
    );
  }

  // Find or create the owner. Creating it up front means the seed works before
  // anyone has signed in; the Google account attaches to this row on first
  // sign-in (see allowDangerousEmailAccountLinking in src/auth.ts).
  let [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!owner) {
    const id = crypto.randomUUID();
    await db.insert(users).values({ id, email, name: email.split('@')[0] });
    owner = { id };
    console.log(`Created a placeholder user for ${email}.`);
  }

  const existing = await db
    .select({ id: trips.id, title: trips.title })
    .from(trips)
    .where(eq(trips.createdBy, owner.id));

  const already = existing.find((trip) => trip.title === TRIP_TITLE);

  if (already && !force) {
    console.log(
      `"${TRIP_TITLE}" already exists (${already.id}). Pass --force to delete and recreate it.`,
    );
    return;
  }

  if (already && force) {
    await db.delete(trips).where(eq(trips.id, already.id));
    console.log(`Deleted the existing "${TRIP_TITLE}" (${already.id}).`);
  }

  const tripId = newTripId();
  await db.transaction(async (tx) => {
    await tx.insert(trips).values({
      id: tripId,
      title: TRIP_TITLE,
      shareToken: newShareToken(),
      createdBy: owner.id,
    });
    await tx
      .insert(tripMembers)
      .values({ tripId, userId: owner.id, role: 'owner' });
  });

  await importBoard(tripId, { cities: [london, ...placeholders] });

  console.log(`\nSeeded "${TRIP_TITLE}"`);
  console.log(`  trip id : ${tripId}`);
  console.log(`  owner   : ${email}`);
  console.log(`  cities  : London (populated) + 4 placeholders`);
  console.log(`\nOpen /t/${tripId} once you are signed in as ${email}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nSeed failed:', error);
    process.exit(1);
  });
