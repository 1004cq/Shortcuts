/**
 * 支付业务逻辑（电脑网站支付）
 *
 * 1. 创建订单 → alipay.trade.page.pay → Form HTML 自动跳转
 * 2. return_url → 成功页；notify_url → 验签 + 更新订单 + success
 * 3. 查单 / 退款 / 日志 / 错误处理
 * 4. 密钥仅 .env；订单号唯一；notify_id 防重放
 */
const config = require("../config/alipay");
const logger = require("../utils/logger");
const {
  createPagePayForm,
  queryTrade,
  refundTrade,
  verifyNotify,
  generateOutTradeNo,
  isPaidTradeStatus,
  formatAmount,
} = require("../utils/alipaySDK");

/** @type {Map<string, object>} 演示内存订单；生产请换数据库 */
const orders = new Map();

/** notify_id → 处理时间（防重放） */
const processedNotifyIds = new Map();
const NOTIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PRODUCTS = [
  {
    id: "demo01",
    name: "测试商品 A",
    price: 0.01,
    description: "沙箱建议使用 0.01 元测试",
  },
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

function pruneNotifyIds() {
  const now = Date.now();
  for (const [id, t] of processedNotifyIds) {
    if (now - t > NOTIFY_TTL_MS) processedNotifyIds.delete(id);
  }
}

function wantsJson(req) {
  const accept = String(req.get("accept") || "");
  const format = String(req.query.format || req.body?.format || "");
  return format === "json" || accept.includes("application/json");
}

function listProducts(_req, res) {
  res.json({
    products: PRODUCTS,
    alipayConfigured: config.isConfigured(),
    env: config.envName,
    sandbox: config.sandbox,
  });
}

/**
 * POST /api/payment/create
 * 默认返回 Form HTML；?format=json 返回 { payForm, outTradeNo }
 */
function createPayment(req, res) {
  try {
    if (!config.isConfigured()) {
      const err = { error: "支付宝未配置，请编辑 .env 填入 APPID / 应用私钥 / 支付宝公钥" };
      if (wantsJson(req)) return res.status(503).json(err);
      return res.status(503).type("html").send(`<h1>支付宝未配置</h1><p>${err.error}</p>`);
    }

    const productId = req.body?.productId || req.body?.product_id || "demo01";
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) {
      if (wantsJson(req)) return res.status(400).json({ error: "无效商品" });
      return res.status(400).type("html").send("<h1>无效商品</h1>");
    }

    let outTradeNo = generateOutTradeNo("MV");
    let guard = 0;
    while (orders.has(outTradeNo) && guard < 5) {
      outTradeNo = generateOutTradeNo("MV");
      guard += 1;
    }
    if (orders.has(outTradeNo)) {
      throw new Error("无法生成唯一订单号，请重试");
    }

    const order = {
      outTradeNo,
      productId: product.id,
      subject: product.name,
      amount: product.price,
      status: "pending",
      tradeNo: null,
      env: config.envName,
      createdAt: new Date().toISOString(),
      paidAt: null,
      refundedAt: null,
      refundAmount: null,
      notifyIds: [],
    };
    orders.set(outTradeNo, order);

    const payForm = createPagePayForm({
      outTradeNo,
      subject: product.name,
      totalAmount: product.price,
      body: product.description,
    });

    logger.info("payment", "order created", {
      outTradeNo,
      productId: product.id,
      amount: product.price,
      env: config.envName,
    });

    if (wantsJson(req)) {
      return res.json({
        outTradeNo,
        amount: product.price,
        subject: product.name,
        env: config.envName,
        payForm,
        message: "将 payForm 写入页面后 form.submit() 即可跳转支付宝",
      });
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(payForm);
  } catch (err) {
    logger.error("payment", "createPayment failed", { err: err.message });
    if (wantsJson(req)) {
      return res.status(500).json({ error: err.message || "创建支付失败" });
    }
    return res
      .status(500)
      .type("html")
      .send(`<h1>创建支付失败</h1><pre>${String(err.message || err)}</pre>`);
  }
}

/**
 * POST /api/payment/notify — 异步通知（必须返回纯文本 success）
 */
async function notifyPayment(req, res) {
  const payload = req.body || {};
  const outTradeNo = payload.out_trade_no;
  const notifyId = payload.notify_id;

  try {
    if (!config.isConfigured()) {
      logger.error("notify", "not configured");
      return res.status(503).send("fail");
    }

    if (!payload.sign) {
      logger.warn("notify", "missing sign", { outTradeNo });
      return res.status(400).send("fail");
    }

    if (!verifyNotify(payload)) {
      logger.error("notify", "bad signature", { outTradeNo, notifyId });
      return res.status(400).send("fail");
    }

    if (payload.app_id && payload.app_id !== config.appId) {
      logger.error("notify", "app_id mismatch", { got: payload.app_id });
      return res.status(400).send("fail");
    }

    pruneNotifyIds();
    if (notifyId && processedNotifyIds.has(notifyId)) {
      logger.info("notify", "replay ignored", { notifyId, outTradeNo });
      return res.send("success");
    }

    if (!isPaidTradeStatus(payload.trade_status)) {
      logger.info("notify", "non-final status", {
        outTradeNo,
        tradeStatus: payload.trade_status,
      });
      if (notifyId) processedNotifyIds.set(notifyId, Date.now());
      return res.send("success");
    }

    const order = orders.get(outTradeNo);
    if (!order) {
      logger.error("notify", "order not found", { outTradeNo });
      return res.status(404).send("fail");
    }

    if (Math.abs(Number(payload.total_amount) - Number(order.amount)) > 0.001) {
      logger.error("notify", "amount mismatch", {
        outTradeNo,
        got: payload.total_amount,
        expect: order.amount,
      });
      return res.status(400).send("fail");
    }

    if (order.status === "paid" || order.status === "refunded") {
      if (notifyId) {
        processedNotifyIds.set(notifyId, Date.now());
        order.notifyIds.push(notifyId);
      }
      logger.info("notify", "already settled", { outTradeNo, status: order.status });
      return res.send("success");
    }

    order.status = "paid";
    order.tradeNo = payload.trade_no || null;
    order.paidAt = payload.gmt_payment || new Date().toISOString();
    if (notifyId) {
      processedNotifyIds.set(notifyId, Date.now());
      order.notifyIds.push(notifyId);
    }
    orders.set(outTradeNo, order);

    logger.info("notify", "order paid", {
      outTradeNo,
      tradeNo: order.tradeNo,
      amount: order.amount,
    });

    return res.send("success");
  } catch (err) {
    logger.error("notify", "exception", { outTradeNo, err: err.message });
    return res.status(500).send("fail");
  }
}

/**
 * GET /api/payment/return — 同步回跳 → 成功页
 */
async function returnPayment(req, res) {
  const params = Object.fromEntries(
    Object.entries(req.query || {}).map(([k, v]) => [k, String(v)])
  );
  const outTradeNo = params.out_trade_no || "";
  const successUrl = new URL("/success.html", config.baseUrl);
  if (outTradeNo) successUrl.searchParams.set("out_trade_no", outTradeNo);

  try {
    if (config.isConfigured() && params.sign) {
      if (!verifyNotify(params)) {
        logger.warn("return", "invalid signature", { outTradeNo });
        successUrl.searchParams.set("status", "invalid");
        return res.redirect(successUrl.toString());
      }
    }

    if (outTradeNo && config.isConfigured()) {
      try {
        const q = await queryTrade(outTradeNo);
        const tradeStatus = String(q.tradeStatus || q.trade_status || "");
        if (isPaidTradeStatus(tradeStatus)) {
          const order = orders.get(outTradeNo);
          if (order && order.status === "pending") {
            order.status = "paid";
            order.tradeNo = String(q.tradeNo || q.trade_no || params.trade_no || "");
            order.paidAt = new Date().toISOString();
            orders.set(outTradeNo, order);
          }
          successUrl.searchParams.set("status", "success");
          return res.redirect(successUrl.toString());
        }
      } catch (err) {
        logger.warn("return", "query failed", { outTradeNo, err: err.message });
      }
    }

    successUrl.searchParams.set("status", "pending");
    return res.redirect(successUrl.toString());
  } catch (err) {
    logger.error("return", "exception", { err: err.message });
    successUrl.searchParams.set("status", "error");
    return res.redirect(successUrl.toString());
  }
}

/** GET /api/payment/query?outTradeNo= */
async function queryPayment(req, res) {
  try {
    const outTradeNo = String(req.query.outTradeNo || req.query.out_trade_no || "");
    if (!outTradeNo) {
      return res.status(400).json({ error: "缺少 outTradeNo" });
    }

    let order = orders.get(outTradeNo) || null;
    let remote = null;

    if (order && order.status === "pending" && config.isConfigured()) {
      try {
        remote = await queryTrade(outTradeNo);
        const tradeStatus = String(remote.tradeStatus || remote.trade_status || "");
        if (isPaidTradeStatus(tradeStatus)) {
          order.status = "paid";
          order.tradeNo = String(remote.tradeNo || remote.trade_no || "");
          order.paidAt = new Date().toISOString();
          orders.set(outTradeNo, order);
        }
      } catch (err) {
        logger.warn("query", "remote failed", { outTradeNo, err: err.message });
      }
    }

    if (!order) {
      return res.status(404).json({
        error: "订单不存在（演示服务重启后内存订单会丢失，生产请落库）",
      });
    }

    return res.json({ order, remote, env: config.envName });
  } catch (err) {
    logger.error("query", "exception", { err: err.message });
    return res.status(500).json({ error: err.message || "查询失败" });
  }
}

/** POST /api/payment/refund */
async function refundPayment(req, res) {
  try {
    if (!config.isConfigured()) {
      return res.status(503).json({ error: "支付宝未配置" });
    }

    const outTradeNo = String(req.body?.outTradeNo || req.body?.out_trade_no || "");
    if (!outTradeNo) {
      return res.status(400).json({ error: "缺少 outTradeNo" });
    }

    const order = orders.get(outTradeNo);
    if (!order) return res.status(404).json({ error: "订单不存在" });
    if (order.status !== "paid") {
      return res.status(400).json({ error: `订单状态不可退款: ${order.status}` });
    }

    const refundAmount =
      req.body?.refundAmount != null ? Number(req.body.refundAmount) : Number(order.amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > order.amount) {
      return res.status(400).json({ error: "退款金额无效" });
    }

    const result = await refundTrade({
      outTradeNo,
      refundAmount,
      refundReason: req.body?.reason || "演示退款",
    });

    const code = String(result.code || "");
    if (code && code !== "10000") {
      logger.error("refund", "rejected", { outTradeNo, result });
      return res.status(400).json({
        error: result.subMsg || result.msg || "退款失败",
        result,
      });
    }

    order.status = "refunded";
    order.refundedAt = new Date().toISOString();
    order.refundAmount = Number(formatAmount(refundAmount));
    orders.set(outTradeNo, order);

    logger.info("refund", "ok", { outTradeNo, refundAmount });
    return res.json({ order, result });
  } catch (err) {
    logger.error("refund", "exception", { err: err.message });
    return res.status(500).json({ error: err.message || "退款失败" });
  }
}

module.exports = {
  listProducts,
  createPayment,
  notifyPayment,
  returnPayment,
  queryPayment,
  refundPayment,
  PRODUCTS,
};
