import { connectDB } from "@/lib/db";
import { PlayPack } from "@/models/PlayPack";
import { PlayOrder } from "@/models/PlayOrder";
import { User } from "@/models/User";
import { ensureShortlinkForMediaVaultUser } from "@/lib/shortlink";
import { Types } from "mongoose";

const DEFAULT_PACKS = [
  { label: "10 次", times: 10, priceYuan: 5, sort: 10, highlighted: false },
  { label: "50 次", times: 50, priceYuan: 20, sort: 20, highlighted: true },
  { label: "100 次", times: 100, priceYuan: 35, sort: 30, highlighted: false },
  { label: "500 次", times: 500, priceYuan: 150, sort: 40, highlighted: false },
];

/** Seed default packs once when collection is empty */
export async function ensureDefaultPlayPacks() {
  await connectDB();
  const count = await PlayPack.countDocuments();
  if (count > 0) return;
  await PlayPack.insertMany(
    DEFAULT_PACKS.map((p) => ({ ...p, enabled: true }))
  );
}

export async function listEnabledPlayPacks() {
  await ensureDefaultPlayPacks();
  return PlayPack.find({ enabled: true }).sort({ sort: 1, times: 1 }).lean();
}

export async function listAllPlayPacks() {
  await ensureDefaultPlayPacks();
  return PlayPack.find().sort({ sort: 1, times: 1 }).lean();
}

/**
 * Credit play times onto the user's shortlink remainingTimes.
 */
export async function creditPlayTimes(opts: {
  mediaVaultUserId: string;
  times: number;
}) {
  const times = Math.max(0, Math.floor(opts.times));
  if (times <= 0) return null;

  const user = await User.findById(opts.mediaVaultUserId).lean();
  const shortlink = await ensureShortlinkForMediaVaultUser({
    mediaVaultUserId: opts.mediaVaultUserId,
    username: user?.username,
    name: user?.name,
  });

  shortlink.remainingTimes = (shortlink.remainingTimes || 0) + times;
  await shortlink.save();
  return shortlink;
}

/**
 * Fulfill a paid PlayOrder: mark paid + credit times. Idempotent.
 */
export async function fulfillPlayOrder(opts: {
  outTradeNo: string;
  tradeNo?: string | null;
  totalAmount?: string | number | null;
  paidAt?: Date;
}) {
  await connectDB();

  const order = await PlayOrder.findOne({
    providerPaymentId: opts.outTradeNo,
  });
  if (!order) {
    return { ok: false as const, reason: "order_not_found" as const };
  }

  if (opts.totalAmount != null && opts.totalAmount !== "") {
    const paid = Number(opts.totalAmount);
    if (!Number.isFinite(paid) || Math.abs(paid - Number(order.amount)) > 0.001) {
      return { ok: false as const, reason: "amount_mismatch" as const, order };
    }
  }

  if (order.status === "paid") {
    return { ok: true as const, already: true as const, order };
  }

  const paidAt = opts.paidAt || new Date();
  order.status = "paid";
  order.paidAt = paidAt;
  if (opts.tradeNo) order.providerTradeNo = opts.tradeNo;
  await order.save();

  await creditPlayTimes({
    mediaVaultUserId: String(order.userId),
    times: order.times,
  });

  return { ok: true as const, already: false as const, order };
}

export async function hasPlayOrderNotifyId(
  outTradeNo: string,
  notifyId?: string | null
) {
  if (!notifyId) return false;
  await connectDB();
  return Boolean(
    await PlayOrder.exists({
      providerPaymentId: outTradeNo,
      alipayNotifyIds: notifyId,
    })
  );
}

export async function addPlayOrderNotifyId(
  outTradeNo: string,
  notifyId?: string | null
) {
  if (!notifyId || !outTradeNo) return;
  await connectDB();
  await PlayOrder.updateOne(
    { providerPaymentId: outTradeNo },
    { $addToSet: { alipayNotifyIds: notifyId } }
  );
}

export function serializePack(doc: {
  _id: Types.ObjectId | string;
  label: string;
  times: number;
  priceYuan: number;
  enabled?: boolean;
  sort?: number;
  highlighted?: boolean;
}) {
  return {
    _id: String(doc._id),
    label: doc.label,
    times: doc.times,
    priceYuan: doc.priceYuan,
    enabled: doc.enabled !== false,
    sort: doc.sort ?? 0,
    highlighted: Boolean(doc.highlighted),
  };
}
