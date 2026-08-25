import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import {
  drizzle as drizzleNode,
  type NodePgDatabase,
} from 'drizzle-orm/node-postgres';
import { Pool as NodePool } from 'pg';
import ws from 'ws';

import * as schema from './schema';

// Neon's driver talks WebSocket for pooled (transaction-capable) connections.
// Node 22+ and the Vercel runtimes expose a global WebSocket; older Node does
// not, so fall back to the `ws` package.
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

/**
 * A syntactically valid stand-in used when DATABASE_URL is absent.
 *
 * The Drizzle client has to be a real instance at module scope — the Auth.js
 * adapter inspects its prototype to work out the dialect, so it cannot be
 * wrapped in a lazy proxy. Constructing a pool does not open a connection, so
 * this keeps `next build` (which imports every route to collect page data)
 * working on a machine with no database configured, and fails with a clear
 * connection error only if a query is actually attempted.
 */
const PLACEHOLDER = 'postgresql://unset:unset@localhost:5432/unset';

const connectionString = process.env.DATABASE_URL || PLACEHOLDER;

/**
 * Neon in production; plain node-postgres for a local database.
 *
 * Neon's serverless driver speaks its own WebSocket protocol and cannot reach
 * an ordinary Postgres, so pointing DATABASE_URL at localhost — for tests, or
 * for working offline — selects the standard driver instead. Both are
 * `PgDatabase` underneath, so the adapter, the schema and every query are
 * identical either way.
 */
const useNeon =
  process.env.DB_DRIVER === 'neon' ||
  (process.env.DB_DRIVER !== 'postgres' && /neon\.tech/.test(connectionString));

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  console.warn(
    '[trip.ly] DATABASE_URL is not set — copy .env.example to .env.local and paste your Neon connection string.',
  );
}

declare global {
  var __triplyPool: NeonPool | NodePool | undefined;
}

// Reuse the pool across hot reloads in dev, and across warm invocations in
// serverless, instead of opening a socket per request.
const pool =
  globalThis.__triplyPool ??
  (useNeon
    ? new NeonPool({ connectionString })
    : new NodePool({ connectionString }));

if (process.env.NODE_ENV !== 'production') globalThis.__triplyPool = pool;

export const db = (
  useNeon
    ? drizzleNeon(pool as NeonPool, { schema })
    : drizzleNode(pool as NodePool, { schema })
) as NodePgDatabase<typeof schema>;

export { schema };
export * from './schema';
