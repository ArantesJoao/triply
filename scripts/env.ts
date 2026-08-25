/**
 * Loads .env.local for standalone scripts.
 *
 * Must be the FIRST import in any script that touches the database: ES module
 * dependencies are evaluated in import order, and src/lib/db reads
 * DATABASE_URL at module scope. Calling dotenv inline instead would run after
 * the hoisted imports have already been evaluated.
 *
 * Override the file with ENV_FILE=.env.test.
 */
import { config } from 'dotenv';

config({ path: process.env.ENV_FILE ?? '.env.local', quiet: true });
