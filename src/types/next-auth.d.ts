import type { DefaultSession } from "next-auth";
import type { MembershipPlan, UserRole } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      membership: MembershipPlan;
      membershipExpiresAt?: string | null;
      emailVerified: boolean;
      username?: string | null;
      phone?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: UserRole;
    membership: MembershipPlan;
    membershipExpiresAt?: string | null;
    emailVerified: boolean;
    username?: string | null;
    phone?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    membership?: MembershipPlan;
    membershipExpiresAt?: string | null;
    emailVerified?: boolean;
    username?: string | null;
    phone?: string | null;
  }
}
