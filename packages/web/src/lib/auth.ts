import { NextAuthOptions } from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).id = user.id;
      }

      const account = await prisma.account.findFirst({
        where: { userId: user.id, provider: "twitter" },
      });
      if (account) {
        (session as unknown as Record<string, unknown>).accessToken =
          account.access_token;
        (session.user as unknown as Record<string, unknown>).twitterId =
          account.providerAccountId;
      }

      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
