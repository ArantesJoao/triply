import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
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
 * wrapped in a lazy proxy. Constructing a Pool does not open a connection, so
 * this keeps `next build` (which imports every route to collect page data)
 * working on a machine with no database configured, and fails with a clear
 * message only if a query is actually attempted.
 */
const PLACEHOLDER = 'postgresql://unset:unset@localhost:5432/unset';

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== 'production') {
  console.warn(
    '[trip.ly] DATABASE_URL is not set — copy .env.example to .env.local and paste your Neon connection string.',
  );
}

declare global {
  var __triplyPool: Pool | undefined;
}

// Reuse the pool across hot reloads in dev, and across warm invocations in
// serverless, instead of opening a socket per request.
const pool =
  globalThis.__triplyPool ??
  new Pool({ connectionString: connectionString || PLACEHOLDER });

if (process.env.NODE_ENV !== 'production') globalThis.__triplyPool = pool;

export const db = drizzle(pool, { schema });

export { schema };
export * from './schema';
