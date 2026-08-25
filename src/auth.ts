import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

import { accounts, db, sessions, users, verificationTokens } from '@/lib/db';
import { claimPendingInvites } from '@/server/invites';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  // JWT sessions keep page loads to a single round trip; the adapter is still
  // present so users/accounts persist and trip membership can reference them.
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Turn any invitations addressed to this email into real memberships.
      // Runs on every sign-in, not just the first, so an invite sent to an
      // address that already has an account is picked up on their next visit.
      if (user.id && user.email) {
        await claimPendingInvites(user.id, user.email);
      }
    },
  },
});
