import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Next loads .env.local automatically; drizzle-kit does not. Override with
// ENV_FILE=.env.test to point the CLI at a different database.
config({ path: process.env.ENV_FILE ?? '.env.local', quiet: true });
config({ path: '.env', quiet: true });

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
