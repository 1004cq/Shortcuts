import { connectDB } from "@/lib/db";
import { Subscription } from "@/models/Subscription";
import { User } from "@/models/User";
import type { MembershipPlan } from "@/types";

export function calcMembershipWindow(
  plan: Exclude<MembershipPlan, "free">,
  from = new Date()
) {
  const startsAt = new Date(from);
  const endsAt = new Date(startsAt);
  if (plan === "monthly") {
    endsAt.setMonth(endsAt.getMonth() + 1);
  } else {
    endsAt.setFullYear(endsAt.getFullYear() + 1);
  }
  return { startsAt, endsAt };
}

export function generateOutTradeNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MV${ts}${rand}`;
}

/**
 * Mark a pending subscription paid and activate VIP on the user.
 * Idempotent when the order is already active.
 */
export async function fulfillPaidSubscription(opts: {
  outTradeNo: string;
  tradeNo?: string | null;
  totalAmount?: string | number | null;
  paidAt?: Date;
}) {
  await connectDB();

  const sub = await Subscription.findOne({ providerPaymentId: opts.outTradeNo });
  if (!sub) {
    return { ok: false as const, reason: "order_not_found" as const };
  }

  if (opts.totalAmount != null && opts.totalAmount !== "") {
    const paid = Number(opts.totalAmount);
    if (!Number.isFinite(paid) || Math.abs(paid - Number(sub.amount)) > 0.001) {
      return { ok: false as const, reason: "amount_mismatch" as const, subscription: sub };
    }
  }

  const user = await User.findById(sub.userId);
  if (!user) {
    return { ok: false as const, reason: "user_not_found" as const, subscription: sub };
  }

  if (sub.status === "active") {
    return {
      ok: true as const,
      already: true as const,
      subscription: sub,
      user,
    };
  }

  const paidAt = opts.paidAt || new Date();
  let periodStart = paidAt;
  if (user.membershipExpiresAt && user.membershipExpiresAt > paidAt) {
    periodStart = user.membershipExpiresAt;
  }
  const { endsAt } = calcMembershipWindow(sub.plan as "monthly" | "yearly", periodStart);

  sub.status = "active";
  sub.startsAt = paidAt;
  sub.endsAt = endsAt;
  if (opts.tradeNo) {
    sub.providerTradeNo = opts.tradeNo;
  }
  await sub.save();

  if (user.role !== "admin") {
    user.role = "vip";
  }
  user.membership = sub.plan;
  user.membershipExpiresAt = endsAt;
  await user.save();

  return {
    ok: true as const,
    already: false as const,
    subscription: sub,
    user,
  };
}
