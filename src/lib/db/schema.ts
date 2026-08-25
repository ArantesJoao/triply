import {
  boolean,
  date,
  index,
  integer,
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
