import './env';

import { eq } from 'drizzle-orm';

import { db, users } from '../src/lib/db';
import { createToken } from '../src/server/tokens';

async function main() {
  const email = process.env.SEED_OWNER_EMAIL!.toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) throw new Error(`No user for ${email}`);
  const { token } = await createToken(user.id, 'e2e test');
  console.log(token);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
