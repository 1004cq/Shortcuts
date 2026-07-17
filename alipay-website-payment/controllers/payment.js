/**
 * 支付业务控制器
 * ------------------------------------------------------------
 * POST /create-payment  创建订单 + 返回支付宝 Form HTML
 * GET  /return          同步跳转，展示订单结果
 * POST /notify          异步通知：RSA2 验签 → 更新订单 → "success"
 *
 * 订单使用内存 Map 存储（演示用；生产请换数据库）
 */
const config = require("../config/alipay");
const logger = require("../utils/logger");
const {
  createPagePayForm,
  queryTrade,
  verifyNotify,
  generateOutTradeNo,
  isPaidTradeStatus,
  formatAmount,
} = require("../utils/alipaySDK");

/** @type {Map<string, object>} out_trade_no → 订单 */
const orders = new Map();

/** 已处理的 notify_id，防止重复通知篡改/重放 */
const processedNotifyIds = new Map();
const NOTIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function pruneNotifyIds() {
  const now = Date.now();
  for (const [id, t] of processedNotifyIds) {
    if (now - t > NOTIFY_TTL_MS) processedNotifyIds.delete(id);
  }
}

/**
 * 首页商品信息（供前端展示）
 * GET /api/product
 */
function getProduct(_req, res) {
  res.json({
    product: config.product,
    env: config.envName,
    sandbox: config.sandbox,
    configured: config.isConfigured(),
  });
}

/**
 * 创建支付订单
 * POST /create-payment
 *
 * Body(可选 JSON):
 *   { title?, amount?, desc? }  — 不传则使用 .env 中的演示商品
 *
 * 成功：直接返回 text/html（支付宝 Form，浏览器自动跳转）
 * 若 Accept: application/json 或 ?format=json：返回 { payForm, outTradeNo }
 */
function createPayment(req, res) {
  try {
    if (!config.isConfigured()) {
      return res.status(503).json({
        error: "支付宝未配置，请在 .env 填写 APP_ID / PRIVATE_KEY / ALIPAY_PUBLIC_KEY",
      });
    }

    const product = config.product;
    const subject = String(req.body?.title || req.body?.subject || product.title);
    const amount = Number(req.body?.amount != null ? req.body.amount : product.amount);
    const body = String(req.body?.desc || req.body?.body || product.desc);

    if (!subject || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "商品标题或金额无效" });
    }

    // 生成唯一订单号：ORDER_ + 时间戳 + 随机数
    let outTradeNo = generateOutTradeNo();
    let guard = 0;
    while (orders.has(outTradeNo) && guard < 5) {
      outTradeNo = generateOutTradeNo();
      guard += 1;
    }

    const order = {
      outTradeNo,
      subject,
      amount: Number(formatAmount(amount)),
      body,
      status: "pending", // pending | paid | closed | refunded
      tradeNo: null,
      env: config.envName,
      createdAt: new Date().toISOString(),
      paidAt: null,
      // 简易超时标记：创建后 30 分钟未支付视为超时（展示用）
      expireAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      notifyIds: [],
      lastError: null,
    };
    orders.set(outTradeNo, order);

    // 调用支付宝电脑网站支付，拿到自动提交 Form
    const payForm = createPagePayForm({
      outTradeNo,
      subject,
      totalAmount: order.amount,
      body,
    });

    logger.info("payment", "订单已创建", {
      outTradeNo,
      amount: order.amount,
      env: config.envName,
    });

    const wantJson =
      String(req.query.format || "") === "json" ||
      String(req.get("accept") || "").includes("application/json");

    if (wantJson) {
      return res.json({
        outTradeNo,
        amount: order.amount,
        subject,
        env: config.envName,
        payForm,
        message: "请将 payForm 写入页面并自动 submit",
      });
    }

    // 默认：直接把 Form HTML 返回给浏览器，自动跳转支付宝
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(payForm);
  } catch (err) {
    logger.error("payment", "创建支付失败", { err: err.message });
    return res.status(500).json({ error: err.message || "创建支付失败" });
  }
}

/**
 * 异步通知
 * POST /notify
 *
 * 必须：
 *  1. RSA2 严格验签
 *  2. 校验 app_id、订单号、金额
 *  3. 幂等更新订单
 *  4. 返回纯文本 success（否则支付宝会重试）
 */
async function notifyPayment(req, res) {
  const payload = req.body || {};
  const outTradeNo = payload.out_trade_no;
  const notifyId = payload.notify_id;

  try {
    if (!config.isConfigured()) {
      logger.error("notify", "未配置密钥");
      return res.status(503).send("fail");
    }

    if (!payload.sign || !payload.sign_type) {
      logger.warn("notify", "缺少签名字段", { outTradeNo });
      return res.status(400).send("fail");
    }

    // —— 严格 RSA2 验签 ——
    if (!verifyNotify(payload)) {
      logger.error("notify", "验签失败", { outTradeNo, notifyId });
      return res.status(400).send("fail");
    }

    if (payload.app_id && payload.app_id !== config.appId) {
      logger.error("notify", "app_id 不匹配", { got: payload.app_id });
      return res.status(400).send("fail");
    }

    pruneNotifyIds();
    if (notifyId && processedNotifyIds.has(notifyId)) {
      logger.info("notify", "重复通知已忽略（防重放）", { notifyId, outTradeNo });
      return res.send("success");
    }

    const tradeStatus = payload.trade_status;

    // 未到终态：确认收到即可
    if (!isPaidTradeStatus(tradeStatus)) {
      logger.info("notify", "非成功状态", { outTradeNo, tradeStatus });
      if (tradeStatus === "TRADE_CLOSED") {
        const order = orders.get(outTradeNo);
        if (order && order.status === "pending") {
          order.status = "closed";
          order.lastError = "交易关闭/超时";
          orders.set(outTradeNo, order);
        }
      }
      if (notifyId) processedNotifyIds.set(notifyId, Date.now());
      return res.send("success");
    }

    const order = orders.get(outTradeNo);
    if (!order) {
      logger.error("notify", "本地订单不存在", { outTradeNo });
      return res.status(404).send("fail");
    }

    if (Math.abs(Number(payload.total_amount) - Number(order.amount)) > 0.001) {
      logger.error("notify", "金额不匹配", {
        outTradeNo,
        got: payload.total_amount,
        expect: order.amount,
      });
      return res.status(400).send("fail");
    }

    // 幂等：已支付仍返回 success
    if (order.status === "paid") {
      if (notifyId) {
        processedNotifyIds.set(notifyId, Date.now());
        order.notifyIds.push(notifyId);
      }
      return res.send("success");
    }

    order.status = "paid";
    order.tradeNo = payload.trade_no || null;
    order.paidAt = payload.gmt_payment || new Date().toISOString();
    order.lastError = null;
    if (notifyId) {
      processedNotifyIds.set(notifyId, Date.now());
      order.notifyIds.push(notifyId);
    }
    orders.set(outTradeNo, order);

    logger.info("notify", "订单支付成功", {
      outTradeNo,
      tradeNo: order.tradeNo,
      amount: order.amount,
    });

    return res.send("success");
  } catch (err) {
    logger.error("notify", "处理异常", { outTradeNo, err: err.message });
    return res.status(500).send("fail");
  }
}

/**
 * 同步跳转
 * GET /return
 *
 * 展示成功/失败/处理中页面（最终以异步 notify 为准）
 * 会尝试 trade.query 加速确认
 */
async function returnPayment(req, res) {
  const params = Object.fromEntries(
    Object.entries(req.query || {}).map(([k, v]) => [k, String(v)])
  );
  const outTradeNo = params.out_trade_no || "";

  // 跳转到前端成功页，带上订单号与初步状态
  const page = new URL("/success.html", config.baseUrl);
  if (outTradeNo) page.searchParams.set("out_trade_no", outTradeNo);

  try {
    // 同步回跳参数也应验签（防篡改）
    if (config.isConfigured() && params.sign) {
      if (!verifyNotify(params)) {
        logger.warn("return", "同步回跳验签失败", { outTradeNo });
        page.searchParams.set("status", "invalid");
        return res.redirect(page.toString());
      }
    }

    if (outTradeNo && config.isConfigured()) {
      try {
        const q = await queryTrade(outTradeNo);
        const tradeStatus = String(q.tradeStatus || q.trade_status || "");
        const order = orders.get(outTradeNo);

        if (isPaidTradeStatus(tradeStatus)) {
          if (order && order.status === "pending") {
            order.status = "paid";
            order.tradeNo = String(q.tradeNo || q.trade_no || params.trade_no || "");
            order.paidAt = new Date().toISOString();
            orders.set(outTradeNo, order);
          }
          page.searchParams.set("status", "success");
          return res.redirect(page.toString());
        }

        if (tradeStatus === "TRADE_CLOSED" || tradeStatus === "WAIT_BUYER_PAY") {
          if (order && order.status === "pending" && tradeStatus === "TRADE_CLOSED") {
            order.status = "closed";
            order.lastError = "交易关闭或超时未支付";
            orders.set(outTradeNo, order);
          }
          page.searchParams.set("status", tradeStatus === "TRADE_CLOSED" ? "closed" : "pending");
          return res.redirect(page.toString());
        }
      } catch (err) {
        logger.warn("return", "主动查单失败", { outTradeNo, err: err.message });
      }
    }

    page.searchParams.set("status", "pending");
    return res.redirect(page.toString());
  } catch (err) {
    logger.error("return", "异常", { err: err.message });
    page.searchParams.set("status", "error");
    return res.redirect(page.toString());
  }
}

/**
 * 查询本地订单（前端轮询）
 * GET /order/:outTradeNo  或  GET /api/order?outTradeNo=
 */
async function queryOrder(req, res) {
  try {
    const outTradeNo = String(
      req.params.outTradeNo || req.query.outTradeNo || req.query.out_trade_no || ""
    );
    if (!outTradeNo) {
      return res.status(400).json({ error: "缺少 outTradeNo" });
    }

    let order = orders.get(outTradeNo) || null;
    if (!order) {
      return res.status(404).json({
        error: "订单不存在（服务重启后内存订单会丢失）",
      });
    }

    // 超时展示：本地 pending 且超过 expireAt
    if (order.status === "pending" && order.expireAt && Date.now() > Date.parse(order.expireAt)) {
      order = { ...order, timedOut: true, lastError: order.lastError || "等待支付超时（本地标记）" };
    }

    // 仍 pending 时尝试向支付宝查一次
    if (order.status === "pending" && config.isConfigured() && !order.timedOut) {
      try {
        const remote = await queryTrade(outTradeNo);
        const tradeStatus = String(remote.tradeStatus || remote.trade_status || "");
        if (isPaidTradeStatus(tradeStatus)) {
          order.status = "paid";
          order.tradeNo = String(remote.tradeNo || remote.trade_no || "");
          order.paidAt = new Date().toISOString();
          order.timedOut = false;
          order.lastError = null;
          orders.set(outTradeNo, order);
        } else if (tradeStatus === "TRADE_CLOSED") {
          order.status = "closed";
          order.lastError = "交易关闭或超时未支付";
          orders.set(outTradeNo, order);
        }
      } catch (err) {
        logger.warn("query", "远程查单失败", { outTradeNo, err: err.message });
      }
    }

    return res.json({ order, env: config.envName });
  } catch (err) {
    logger.error("query", "异常", { err: err.message });
    return res.status(500).json({ error: err.message || "查询失败" });
  }
}

module.exports = {
  getProduct,
  createPayment,
  notifyPayment,
  returnPayment,
  queryOrder,
  // 测试辅助
  _orders: orders,
};
