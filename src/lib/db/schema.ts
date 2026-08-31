import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';

/* ------------------------------------------------------------------ *
 * Auth.js tables (shape dictated by @auth/drizzle-adapter)
 * ------------------------------------------------------------------ */

export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ------------------------------------------------------------------ *
 * Trip.ly domain
 *
 * Trip ──< City ──< Column ──< Item
 *   └──< TripMember >── User
 *   └──< TripInvite (by email, claimed on first sign-in)
 * ------------------------------------------------------------------ */

export const trips = pgTable('trip', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  /** Which city tab the board opens on. Null until the first city exists. */
  activeCityId: text('active_city_id'),
  /** Secret component of the /join/<token> invite link. */
  shareToken: text('share_token').notNull().unique(),
  createdBy: text('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  /**
   * Per-tag colour overrides: `{ [tagName]: paletteIndex }`.
   * Tags not in the map fall back to the deterministic hash colour.
   */
  tagColors: jsonb('tag_colors').$type<Record<string, number>>().default({}),
  /**
   * Per-tag icon overrides: `{ [tagName]: iconKey }`, keys from
   * `TAG_ICON_KEYS`. Tags not in the map fall back to a keyword guess on the
   * tag name; an empty-string value means "no icon".
   */
  tagIcons: jsonb('tag_icons').$type<Record<string, string>>().default({}),
  /**
   * Minutes past midnight where the time axis opens — 480 (08:00) by default,
   * mirroring DEFAULT_DAY_START_MIN in src/lib/time.ts. A city may override
   * it; see `city.day_start_min`.
   */
  dayStartMin: integer('day_start_min').notNull().default(480),
  /** Bumped on every mutation; clients poll this to detect other people's edits. */
  revision: integer('revision').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tripMembers = pgTable(
  'trip_member',
  {
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'owner' may delete the trip and manage members; 'editor' may edit content. */
    role: varchar('role', { length: 16 }).notNull().default('editor'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tripId, t.userId] }),
    index('trip_member_user_idx').on(t.userId),
  ],
);

/**
 * An invite issued before the invitee has ever signed in. On first sign-in
 * (and on every sign-in, cheaply) matching rows are converted to memberships.
 */
export const tripInvites = pgTable(
  'trip_invite',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    invitedBy: text('invited_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('trip_invite_trip_email_idx').on(t.tripId, t.email)],
);

/**
 * Bearer tokens for the REST API and MCP server. Google OAuth can't be driven
 * by an agent, so programmatic access uses these instead. Only the SHA-256
 * hash is stored; the plaintext is shown once at creation.
 */
export const apiTokens = pgTable(
  'api_token',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    /** First 8 chars of the plaintext, so the UI can tell tokens apart. */
    prefix: varchar('prefix', { length: 12 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('api_token_user_idx').on(t.userId)],
);

/* ------------------------------------------------------------------ *
 * OAuth 2.1 authorization server
 *
 * What lets a client say "connect to trip.ly" and get a token by sending the
 * user through Google, instead of the user minting an `api_token` by hand and
 * pasting it into a header field. Same access either way — a grant resolves to
 * a user id exactly as a personal token does.
 *
 * Client ──< Grant >── User        (one row per connected app, per person)
 * Client ──< Code  >── User        (seconds-long, single use, then deleted)
 * ------------------------------------------------------------------ */

/**
 * A client that registered itself through RFC 7591 dynamic registration.
 *
 * Registration is open, because that is the only way a client the user has
 * just installed can connect without us pre-provisioning it. An unused row is
 * inert: it cannot get a token without a person completing the consent screen,
 * and `redirectUris` is fixed at registration, so a code can only ever be
 * delivered back to where that client said it lives.
 */
export const oauthClients = pgTable('oauth_client', {
  /** The `client_id`. Public — it travels in authorization URLs. */
  id: text('id').primaryKey(),
  /** Null for a public client, which authenticates with PKCE alone. */
  secretHash: text('secret_hash'),
  name: text('name').notNull(),
  redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
  /** Shown on the consent screen so people can see who is asking. */
  logoUri: text('logo_uri'),
  clientUri: text('client_uri'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * An authorization code in flight — issued when someone presses Allow and
 * redeemed seconds later at the token endpoint.
 *
 * The row *is* the single-use guarantee: redemption deletes it in the same
 * statement that reads it, so a replayed code finds nothing. Only the hash is
 * stored, so the code in a redirect URL in someone's browser history is not
 * enough to mint a token even before it expires.
 */
export const oauthCodes = pgTable('oauth_code', {
  codeHash: text('code_hash').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Must match the one presented at the token endpoint, per RFC 6749. */
  redirectUri: text('redirect_uri').notNull(),
  /** PKCE S256 challenge. Required — there is no `plain` path. */
  codeChallenge: text('code_challenge').notNull(),
  scope: text('scope').notNull(),
  /** RFC 8707 audience, echoed back so we can refuse a code minted for elsewhere. */
  resource: text('resource'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

/**
 * One connected app, for one person: the thing Settings lists and revokes.
 *
 * Access and refresh tokens live on the same row and rotate in place, so
 * revoking is a single delete and there is no way to leave a live refresh
 * token behind an expired access token.
 */
export const oauthGrants = pgTable(
  'oauth_grant',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessTokenHash: text('access_token_hash').notNull().unique(),
    accessExpiresAt: timestamp('access_expires_at', {
      withTimezone: true,
    }).notNull(),
    /** Rotated on every refresh; null once a client stops asking for one. */
    refreshTokenHash: text('refresh_token_hash').unique(),
    scope: text('scope').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('oauth_grant_user_idx').on(t.userId)],
);

export const cities = pgTable(
  'city',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    /** Stable human-readable handle, unique within the trip, e.g. "london". */
    key: text('key').notNull(),
    title: text('title').notNull(),
    /**
     * Overrides the trip's day start for this city alone. Null means inherit —
     * which is not the same as 0, so nothing may read this field directly.
     * A fortnight in Lisbon and a fortnight in Tokyo rarely start at the same
     * hour, and the axis top is what makes a day's empty stretch readable.
     */
    dayStartMin: integer('day_start_min'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('city_trip_key_idx').on(t.tripId, t.key),
    index('city_trip_idx').on(t.tripId),
  ],
);

export const columns = pgTable(
  'column',
  {
    id: text('id').primaryKey(),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
    /** Stable handle, unique within the city. The key "backlog" is reserved. */
    key: text('key').notNull(),
    title: text('title').notNull(),
    /** true = renders against the shared time axis; false = plain ordered list. */
    timed: boolean('timed').notNull().default(true),
    /**
     * The calendar date this day column represents, when known. Combined with
     * item.time + item.dayOffset it yields an unambiguous instant, which is
     * what makes post-midnight items (e.g. a 00:47 arrival) safe.
     */
    date: date('date'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('column_city_key_idx').on(t.cityId, t.key),
    index('column_city_idx').on(t.cityId),
  ],
);

export const items = pgTable(
  'item',
  {
    id: text('id').primaryKey(),
    columnId: text('column_id')
      .notNull()
      .references(() => columns.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(''),
    /** "HH:MM" 24h, or null when unscheduled (lives in the tray / a list). */
    time: varchar('time', { length: 5 }),
    /**
     * Days past the column's own date. 0 for almost everything; 1 for an item
     * that happens after midnight, so "00:47" sorts after "19:33" instead of
     * before it. Replaces the prototype's "hour < 5 means tomorrow" guess.
     */
    dayOffset: integer('day_offset').notNull().default(0),
    /** Optional block length in minutes. Null renders as a point on the axis. */
    durationMin: integer('duration_min'),
    blurb: text('blurb').notNull().default(''),
    tags: text('tags').array().notNull().default([]),
    /** Ordering within a list column, and tie-break within the tray. */
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('item_column_idx').on(t.columnId)],
);
