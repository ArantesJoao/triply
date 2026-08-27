import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

/**
 * Vercel's build entrypoint (Vercel prefers `vercel-build` over `build`).
 *
 * Migrations run here rather than at runtime so the schema can never trail the
 * code that queries it: Drizzle names every column explicitly in its SELECTs,
 * so a deploy that ships ahead of its migration 500s on every read of the
 * table rather than degrading.
 *
 * Only production deploys migrate. Preview deploys share production's
 * DATABASE_URL on this plan, so migrating from one would alter the production
 * schema from an unmerged branch.
 */

const MIGRATIONS_DIR = 'drizzle';

/**
 * `drizzle-kit migrate` reads only the newest row of
 * `drizzle.__drizzle_migrations` and applies every migration newer than it:
 *
 *   if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis)
 *
 * A database created with `drizzle-kit push` has no journal, so `migrate`
 * finds no rows, replays 0000 against tables that already exist, and the
 * transaction aborts. This records 0000 as applied without executing it, so
 * the first real `migrate` starts at 0001.
 *
 * Only `created_at` drives the skip decision; the hash is computed the same
 * way drizzle does so the row is faithful either way.
 *
 * Idempotent, and a no-op on both a fresh database (nothing to baseline, let
 * migrate create everything) and an already-journalled one.
 */
async function baselinePushedDatabase() {
  const journal = JSON.parse(
    readFileSync(`${MIGRATIONS_DIR}/meta/_journal.json`, 'utf8'),
  );
  const first = journal.entries[0];
  if (!first) return;

  const hash = createHash('sha256')
    .update(readFileSync(`${MIGRATIONS_DIR}/${first.tag}.sql`).toString())
    .digest('hex');

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  try {
    // Same DDL drizzle itself runs, so this never conflicts with it.
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const { rows: journalled } = await client.query(
      'SELECT 1 FROM drizzle."__drizzle_migrations" LIMIT 1',
    );
    if (journalled.length > 0) {
      console.log('vercel-build: migration journal present — no baseline needed');
      return;
    }

    // `trip` is created by 0000. Present without a journal means the schema
    // was pushed rather than migrated; absent means a genuinely fresh
    // database, which migrate should build from 0000 as normal.
    const { rows: sentinel } = await client.query(
      "SELECT to_regclass('public.trip') IS NOT NULL AS present",
    );
    if (!sentinel[0].present) {
      console.log('vercel-build: fresh database — migrate will apply 0000 onward');
      return;
    }

    await client.query(
      'INSERT INTO drizzle."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)',
      [hash, first.when],
    );
    console.log(
      `vercel-build: pushed database — baselined ${first.tag} as already applied`,
    );
  } finally {
    await client.end();
  }
}

const env = process.env.VERCEL_ENV ?? 'development';

if (env === 'production') {
  console.log('vercel-build: production deploy — applying migrations');
  await baselinePushedDatabase();
  execSync('drizzle-kit migrate', { stdio: 'inherit' });
} else {
  console.log(`vercel-build: ${env} deploy — skipping migrations`);
}

execSync('next build --turbopack', { stdio: 'inherit' });
