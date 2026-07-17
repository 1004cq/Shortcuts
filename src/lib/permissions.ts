import type { SessionUser, UserRole, MembershipPlan } from "@/types";

/**
 * Permission helpers — single source of truth for VIP / admin gates.
 */

export function isAdmin(user?: Pick<SessionUser, "role"> | null): boolean {
  return user?.role === "admin";
}

export function isVipActive(
  user?: Pick<SessionUser, "role" | "membership" | "membershipExpiresAt"> | null
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "vip" || user.membership === "monthly" || user.membership === "yearly") {
    if (!user.membershipExpiresAt) return user.role === "vip";
    return new Date(user.membershipExpiresAt).getTime() > Date.now();
  }
  return false;
}

/** Free users may browse lists; VIP/admin may download & stream */
export function canDownload(
  user?: Pick<SessionUser, "role" | "membership" | "membershipExpiresAt"> | null
): boolean {
  return isVipActive(user);
}

export function canStream(
  user?: Pick<SessionUser, "role" | "membership" | "membershipExpiresAt"> | null
): boolean {
  return isVipActive(user);
}

export function canUpload(
  user?: Pick<SessionUser, "role"> | null
): boolean {
  return isAdmin(user);
}

export function canManageUsers(
  user?: Pick<SessionUser, "role"> | null
): boolean {
  return isAdmin(user);
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "管理员";
    case "vip":
      return "VIP会员";
    default:
      return "普通用户";
  }
}

export function membershipLabel(plan: MembershipPlan): string {
  switch (plan) {
    case "monthly":
      return "月度会员";
    case "yearly":
      return "年度会员";
    default:
      return "免费用户";
  }
}
