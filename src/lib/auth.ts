import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { isVipActive } from "@/lib/permissions";
import type { SessionUser } from "@/types";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(128),
});

/**
 * NextAuth configuration — credentials (email/password) provider.
 * JWT strategy keeps sessions lightweight for API route checks.
 */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new Error("无效的邮箱或密码格式");
        }

        await connectDB();

        const user = await User.findOne({ email: parsed.data.email.toLowerCase() })
          .select("+password")
          .exec();

        if (!user || !user.password) {
          throw new Error("邮箱或密码错误");
        }

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) {
          throw new Error("邮箱或密码错误");
        }

        // Refresh VIP status if membership expired
        let role = user.role as SessionUser["role"];
        let membership = user.membership as SessionUser["membership"];
        const expiresAt = user.membershipExpiresAt
          ? new Date(user.membershipExpiresAt).toISOString()
          : null;

        const vipStillActive = isVipActive({
          role,
          membership,
          membershipExpiresAt: expiresAt,
        });

        if (!vipStillActive && role === "vip") {
          role = "user";
          membership = "free";
          await User.updateOne(
            { _id: user._id },
            { $set: { role: "user", membership: "free" } }
          );
        }

        await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role,
          membership,
          membershipExpiresAt: expiresAt,
          emailVerified: Boolean(user.emailVerified),
          image: user.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as unknown as SessionUser;
        token.id = u.id;
        token.role = u.role;
        token.membership = u.membership;
        token.membershipExpiresAt = u.membershipExpiresAt ?? null;
        token.emailVerified = u.emailVerified;
      }

      // Allow client-side session.update() to refresh membership after checkout
      if (trigger === "update" && session) {
        const s = session as Partial<SessionUser>;
        if (s.role) token.role = s.role;
        if (s.membership) token.membership = s.membership;
        if (s.membershipExpiresAt !== undefined) {
          token.membershipExpiresAt = s.membershipExpiresAt;
        }
        if (s.emailVerified !== undefined) token.emailVerified = s.emailVerified;
        if (s.name) token.name = s.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as SessionUser;
        u.id = token.id as string;
        u.role = token.role as SessionUser["role"];
        u.membership = token.membership as SessionUser["membership"];
        u.membershipExpiresAt = (token.membershipExpiresAt as string | null) ?? null;
        u.emailVerified = Boolean(token.emailVerified);
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
