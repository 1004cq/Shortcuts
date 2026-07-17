import { randomBytes } from "node:crypto";
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

/** Unique merchant order no. (timestamp + crypto random) */
export function generateOutTradeNo(prefix = "MV"): string {
  return `${prefix}${Date.now()}${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Whether this Alipay notify_id was already processed (anti-replay). */
export async function hasAlipayNotifyId(outTradeNo: string, notifyId?: string | null) {
  if (!notifyId) return false;
  await connectDB();
  const existing = await Subscription.exists({
    providerPaymentId: outTradeNo,
    alipayNotifyIds: notifyId,
  });
  return Boolean(existing);
}

/** Persist notify_id only after a successful / acknowledged notify handling. */
export async function addAlipayNotifyId(outTradeNo: string, notifyId?: string | null) {
  if (!notifyId || !outTradeNo) return;
  await connectDB();
  await Subscription.updateOne(
    { providerPaymentId: outTradeNo },
    { $addToSet: { alipayNotifyIds: notifyId } }
  );
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
