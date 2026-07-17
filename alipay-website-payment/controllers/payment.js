/**
 * 支付业务逻辑
 * 演示用内存订单表；生产请换成数据库。
 */
const config = require("../config/alipay");
const {
  createPayUrl,
  queryTrade,
  verifyNotify,
  generateOutTradeNo,
  isMobileUserAgent,
} = require("../utils/alipaySDK");

/** @type {Map<string, object>} */
const orders = new Map();

const PRODUCTS = [
  {
    id: "monthly",
    name: "MediaVault 月度会员",
    price: 29,
    description: "无限下载 · 在线播放 · 30 天",
  },
  {
    id: "yearly",
    name: "MediaVault 年度会员",
    price: 288,
    description: "无限下载 · 在线播放 · 365 天",
  },
];

function listProducts(_req, res) {
  res.json({
    products: PRODUCTS,
    alipayConfigured: config.isConfigured(),
  });
}

/**
 * 创建订单并返回支付宝收银台 URL
 * POST /api/payment/create  { productId }
 */
function createPayment(req, res) {
  try {
    if (!config.isConfigured()) {
      return res.status(503).json({
        error: "支付宝未配置，请先填写 .env 中的 ALIPAY_* 密钥",
      });
    }

    const productId = req.body?.productId || req.body?.product_id;
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) {
      return res.status(400).json({ error: "无效商品" });
    }

    const outTradeNo = generateOutTradeNo("MV");
    const order = {
      outTradeNo,
      productId: product.id,
      subject: product.name,
      amount: product.price,
      status: "pending",
      tradeNo: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    orders.set(outTradeNo, order);

    const ua = req.get("user-agent");
    const payUrl = createPayUrl({
      outTradeNo,
      subject: product.name,
      totalAmount: product.price,
      body: product.description,
      mobile: isMobileUserAgent(ua),
    });

    return res.json({
      outTradeNo,
      payUrl,
      amount: product.price,
      subject: product.name,
    });
  } catch (err) {
    console.error("[createPayment]", err);
    return res.status(500).json({ error: err.message || "创建支付失败" });
  }
}

/**
 * 异步通知（支付宝服务器 POST）
 * 必须返回纯文本 success
 */
async function notifyPayment(req, res) {
  try {
    if (!config.isConfigured()) {
      return res.status(503).send("fail");
    }

    const payload = req.body || {};
    if (!payload.sign || !verifyNotify(payload)) {
      console.error("[notify] bad signature", payload.out_trade_no);
      return res.status(400).send("fail");
    }

    if (payload.app_id && payload.app_id !== config.appId) {
      return res.status(400).send("fail");
    }

    const status = payload.trade_status;
    if (status !== "TRADE_SUCCESS" && status !== "TRADE_FINISHED") {
      return res.send("success");
    }

    const outTradeNo = payload.out_trade_no;
    const order = orders.get(outTradeNo);
    if (!order) {
      console.error("[notify] order not found", outTradeNo);
      return res.status(404).send("fail");
    }

    if (Math.abs(Number(payload.total_amount) - Number(order.amount)) > 0.001) {
      console.error("[notify] amount mismatch", outTradeNo);
      return res.status(400).send("fail");
    }

    if (order.status !== "paid") {
      order.status = "paid";
      order.tradeNo = payload.trade_no || null;
      order.paidAt = payload.gmt_payment || new Date().toISOString();
      orders.set(outTradeNo, order);
      console.log("[notify] paid", outTradeNo, order.tradeNo);
    }

    return res.send("success");
  } catch (err) {
    console.error("[notify]", err);
    return res.status(500).send("fail");
  }
}

/**
 * 同步回跳：验签 / 查单后跳转成功页
 */
async function returnPayment(req, res) {
  const params = { ...req.query };
  const outTradeNo = String(params.out_trade_no || "");
  const successUrl = new URL("/success.html", config.baseUrl);
  if (outTradeNo) successUrl.searchParams.set("out_trade_no", outTradeNo);

  try {
    if (config.isConfigured() && params.sign) {
      const ok = verifyNotify(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      );
      if (!ok) {
        successUrl.searchParams.set("status", "invalid");
        return res.redirect(successUrl.toString());
      }
    }

    if (outTradeNo && config.isConfigured()) {
      try {
        const q = await queryTrade(outTradeNo);
        const tradeStatus = String(q.tradeStatus || q.trade_status || "");
        if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
          const order = orders.get(outTradeNo);
          if (order && order.status !== "paid") {
            order.status = "paid";
            order.tradeNo = String(q.tradeNo || q.trade_no || params.trade_no || "");
            order.paidAt = new Date().toISOString();
            orders.set(outTradeNo, order);
          }
          successUrl.searchParams.set("status", "success");
          return res.redirect(successUrl.toString());
        }
      } catch (err) {
        console.error("[return] query failed", err);
      }
    }

    successUrl.searchParams.set("status", "pending");
    return res.redirect(successUrl.toString());
  } catch (err) {
    console.error("[return]", err);
    successUrl.searchParams.set("status", "error");
    return res.redirect(successUrl.toString());
  }
}

/**
 * 查询本地订单（可顺带查支付宝）
 * GET /api/payment/query?outTradeNo=
 */
async function queryPayment(req, res) {
  try {
    const outTradeNo = String(req.query.outTradeNo || req.query.out_trade_no || "");
    if (!outTradeNo) {
      return res.status(400).json({ error: "缺少 outTradeNo" });
    }

    let order = orders.get(outTradeNo) || null;

    if (order && order.status !== "paid" && config.isConfigured()) {
      try {
        const q = await queryTrade(outTradeNo);
        const tradeStatus = String(q.tradeStatus || q.trade_status || "");
        if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
          order.status = "paid";
          order.tradeNo = String(q.tradeNo || q.trade_no || "");
          order.paidAt = new Date().toISOString();
          orders.set(outTradeNo, order);
        }
      } catch (err) {
        console.error("[query]", err.message);
      }
    }

    if (!order) {
      return res.status(404).json({ error: "订单不存在（演示服务重启后内存订单会丢失）" });
    }

    return res.json({ order });
  } catch (err) {
    return res.status(500).json({ error: err.message || "查询失败" });
  }
}

module.exports = {
  listProducts,
  createPayment,
  notifyPayment,
  returnPayment,
  queryPayment,
  // 测试辅助
  _orders: orders,
  PRODUCTS,
};
