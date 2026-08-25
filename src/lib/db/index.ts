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

declare global {
  // eslint-disable-next-line no-var
  var __triplyPool: Pool | undefined;
}

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon connection string.',
    );
  }
  // Reuse the pool across hot reloads in dev, and across warm invocations in
  // serverless, instead of opening a socket per request.
  if (!globalThis.__triplyPool) {
    globalThis.__triplyPool = new Pool({ connectionString: url });
  }
  return globalThis.__triplyPool;
}

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * Lazily-constructed Drizzle client. Lazy so that importing this module (which
 * many route files do transitively) doesn't throw at build time when
 * DATABASE_URL is absent.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!cached) cached = drizzle(getPool(), { schema });
    const value = Reflect.get(cached, prop);
    // Bind to the real client, never the proxy, so Drizzle's internals don't
    // re-enter this trap while resolving `this`.
    return typeof value === 'function' ? value.bind(cached) : value;
  },
});

export { schema };
export * from './schema';
