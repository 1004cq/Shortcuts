export const dynamic = "force-dynamic";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { PlayOrder } from "@/models/PlayOrder";
import { PlayPack } from "@/models/PlayPack";
import {
  ApiError,
  jsonOk,
  requireAuth,
  withApiHandler,
} from "@/lib/api";
import {
  createAlipayPayForm,
  isAlipayConfigured,
  isDemoCheckoutAllowed,
  isMobileUserAgent,
} from "@/lib/alipay";
import { generateOutTradeNo } from "@/lib/membership";
import {
  creditPlayTimes,
  ensureDefaultPlayPacks,
  listEnabledPlayPacks,
  serializePack,
} from "@/lib/play-recharge";
import {
  buildPublicShortUrl,
  ensureShortlinkForMediaVaultUser,
} from "@/lib/shortlink";
import { User } from "@/models/User";

/** GET /api/play-orders — packs + my balance + recent orders */
export const GET = withApiHandler(async () => {
  const sessionUser = await requireAuth();
  await connectDB();
  await ensureDefaultPlayPacks();

  const user = await User.findById(sessionUser.id).lean();
  const shortlink = await ensureShortlinkForMediaVaultUser({
    mediaVaultUserId: sessionUser.id,
    username: user?.username,
    name: user?.name,
  });

  const [packs, orders] = await Promise.all([
    listEnabledPlayPacks(),
    PlayOrder.find({ userId: sessionUser.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  return jsonOk({
    packs: packs.map(serializePack),
    balance: {
      shortUrl: buildPublicShortUrl(shortlink.userId),
      shortlinkUserId: shortlink.userId,
      remainingTimes: shortlink.remainingTimes,
      usedTimes: shortlink.usedTimes,
    },
    orders: orders.map((o) => ({
      _id: String(o._id),
      times: o.times,
      amount: o.amount,
      status: o.status,
      provider: o.provider,
      outTradeNo: o.providerPaymentId,
      paidAt: o.paidAt ? new Date(o.paidAt).toISOString() : null,
      createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    })),
    payment: {
      alipay: isAlipayConfigured(),
      demo: isDemoCheckoutAllowed(),
    },
  });
});

const checkoutSchema = z
  .object({
    packId: z.string().min(1).optional(),
    /** Custom times — priced by cheapest ¥/次 among enabled packs */
    customTimes: z.coerce.number().int().min(1).max(10000).optional(),
  })
  .refine((v) => Boolean(v.packId) || v.customTimes !== undefined, {
    message: "请选择档位或填写自定义次数",
  });

function unitPriceFromPacks(
  packs: Array<{ times: number; priceYuan: number }>
): number {
  let best = Infinity;
  for (const p of packs) {
    if (p.times > 0) best = Math.min(best, p.priceYuan / p.times);
  }
  return Number.isFinite(best) ? best : 1;
}

/** POST /api/play-orders — checkout a pack or custom times */
export const POST = withApiHandler(async (req: Request) => {
  const sessionUser = await requireAuth();
  const body = checkoutSchema.parse(await req.json());
  await connectDB();

  let times = 0;
  let amount = 0;
  let packId: string | null = null;
  let packLabel = "";

  if (body.packId) {
    const pack = await PlayPack.findById(body.packId).lean();
    if (!pack || !pack.enabled) {
      throw new ApiError("充值档位不存在或已下架", 404);
    }
    times = pack.times;
    amount = pack.priceYuan;
    packId = String(pack._id);
    packLabel = pack.label;
  } else {
    const packs = await listEnabledPlayPacks();
    if (!packs.length) throw new ApiError("暂无可用充值档位", 400);
    times = body.customTimes!;
    const unit = unitPriceFromPacks(packs as Array<{ times: number; priceYuan: number }>);
    amount = Math.round(unit * times * 100) / 100;
    if (amount < 0.01) amount = 0.01;
    packLabel = `自定义 ${times} 次`;
  }

  if (isAlipayConfigured()) {
    let outTradeNo = generateOutTradeNo("PL");
    for (let i = 0; i < 5; i += 1) {
      const clash = await PlayOrder.exists({ providerPaymentId: outTradeNo });
      if (!clash) break;
      outTradeNo = generateOutTradeNo("PL");
    }

    await PlayOrder.create({
      userId: sessionUser.id,
      packId: packId || null,
      times,
      amount,
      currency: "CNY",
      status: "pending",
      provider: "alipay",
      providerPaymentId: outTradeNo,
      alipayNotifyIds: [],
      note: packLabel,
    });

    const subject = `MediaVault 播放次数 ${times}次`;
    const ua = req.headers.get("user-agent");
    const payForm = createAlipayPayForm({
      outTradeNo,
      subject,
      totalAmount: amount,
      body: `${subject} · ${sessionUser.email}`,
      mobile: isMobileUserAgent(ua),
    });

    return jsonOk({
      mode: "alipay",
      outTradeNo,
      payForm,
      amount,
      times,
      message: "正在跳转支付宝收银台…",
    });
  }

  if (!isDemoCheckoutAllowed()) {
    throw new ApiError("支付宝未配置，且演示支付已关闭", 503);
  }

  const outTradeNo = generateOutTradeNo("PL");
  const order = await PlayOrder.create({
    userId: sessionUser.id,
    packId: packId || null,
    times,
    amount,
    currency: "CNY",
    status: "paid",
    provider: "demo",
    providerPaymentId: outTradeNo,
    paidAt: new Date(),
    note: packLabel,
  });

  const shortlink = await creditPlayTimes({
    mediaVaultUserId: sessionUser.id,
    times,
  });

  return jsonOk({
    mode: "demo",
    outTradeNo,
    order: {
      _id: String(order._id),
      times: order.times,
      amount: order.amount,
      status: order.status,
    },
    balance: shortlink
      ? {
          remainingTimes: shortlink.remainingTimes,
          usedTimes: shortlink.usedTimes,
        }
      : null,
    message: `已充值 ${times} 次（演示模式）`,
  });
});
