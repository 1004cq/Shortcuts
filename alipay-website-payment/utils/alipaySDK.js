/**
 * 支付宝 SDK 封装（官方 alipay-sdk）
 * ------------------------------------------------------------
 * - 电脑网站支付：alipay.trade.page.pay → 返回自动提交的 Form HTML
 * - 异步/同步回调：RSA2 验签（checkNotifySignV2 / checkNotifySign）
 * - 交易查询 / 退款
 */
const crypto = require("node:crypto");
const { Blob: NodeBlob, File: NodeFile } = require("node:buffer");
const { AlipaySdk } = require("alipay-sdk");
const config = require("../config/alipay");
const logger = require("./logger");

// Node 18 兼容：部分依赖依赖全局 File / Blob
if (typeof globalThis.File === "undefined" && typeof NodeFile !== "undefined") {
  globalThis.File = NodeFile;
}
if (typeof globalThis.Blob === "undefined" && typeof NodeBlob !== "undefined") {
  globalThis.Blob = NodeBlob;
}

let cachedSdk = null;
let cachedFingerprint = "";

function fingerprint() {
  return [config.appId, config.gateway, config.keyType].join("|");
}

/** 获取（或重建）SDK 实例 */
function getSdk() {
  if (!config.isConfigured()) {
    throw new Error("支付宝未配置：请在 .env 填写 APP_ID / PRIVATE_KEY / ALIPAY_PUBLIC_KEY");
  }

  const fp = fingerprint();
  if (cachedSdk && cachedFingerprint === fp) return cachedSdk;

  cachedSdk = new AlipaySdk({
    appId: config.appId,
    privateKey: config.privateKey,
    alipayPublicKey: config.alipayPublicKey,
    keyType: config.keyType,
    // 官方推荐 RSA2
    signType: "RSA2",
    gateway: config.gateway,
  });
  cachedFingerprint = fp;

  logger.info("alipaySDK", "SDK 初始化完成", {
    env: config.envName,
    gateway: config.gateway,
    signType: "RSA2",
  });
  return cachedSdk;
}

/** 金额格式化为两位小数字符串 */
function formatAmount(yuan) {
  const n = Number(yuan);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`无效金额: ${yuan}`);
  }
  return n.toFixed(2);
}

/**
 * 生成唯一商户订单号
 * 格式：ORDER_ + 时间戳 + 随机数
 */
function generateOutTradeNo() {
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORDER_${Date.now()}_${rand}`;
}

/**
 * 调用 alipay.trade.page.pay，返回 Form 表单 HTML（前端自动 submit）
 */
function createPagePayForm({ outTradeNo, subject, totalAmount, body }) {
  const sdk = getSdk();

  // httpMethod = 'POST' → 生成带自动提交脚本的 Form HTML
  const html = sdk.pageExecute("alipay.trade.page.pay", "POST", {
    notifyUrl: config.notifyUrl,
    returnUrl: config.returnUrl,
    bizContent: {
      out_trade_no: outTradeNo,
      // 电脑网站支付固定产品码
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: formatAmount(totalAmount),
      subject,
      body: body || subject,
    },
  });

  logger.info("alipaySDK", "page.pay Form 已生成", {
    outTradeNo,
    amount: formatAmount(totalAmount),
    env: config.envName,
  });

  return html;
}

/** 主动查询交易状态 alipay.trade.query */
async function queryTrade(outTradeNo) {
  const sdk = getSdk();
  logger.info("alipaySDK", "trade.query", { outTradeNo });
  return sdk.exec("alipay.trade.query", {
    bizContent: { out_trade_no: outTradeNo },
  });
}

/** 退款 alipay.trade.refund（可选） */
async function refundTrade({ outTradeNo, refundAmount, refundReason, outRequestNo }) {
  const sdk = getSdk();
  const requestNo = outRequestNo || `RF_${Date.now()}_${crypto.randomBytes(2).toString("hex")}`;
  logger.info("alipaySDK", "trade.refund", { outTradeNo, refundAmount, requestNo });
  return sdk.exec("alipay.trade.refund", {
    bizContent: {
      out_trade_no: outTradeNo,
      refund_amount: formatAmount(refundAmount),
      refund_reason: refundReason || "用户申请退款",
      out_request_no: requestNo,
    },
  });
}

/**
 * 严格验签（RSA2）
 * 优先 checkNotifySignV2（不对 value 做 decode），失败再尝试 checkNotifySign
 */
function verifyNotify(payload) {
  const sdk = getSdk();
  try {
    if (sdk.checkNotifySignV2(payload)) return true;
  } catch (err) {
    logger.warn("alipaySDK", "checkNotifySignV2 异常", { err: String(err.message || err) });
  }
  try {
    return sdk.checkNotifySign(payload);
  } catch (err) {
    logger.warn("alipaySDK", "checkNotifySign 异常", { err: String(err.message || err) });
    return false;
  }
}

function isPaidTradeStatus(status) {
  return status === "TRADE_SUCCESS" || status === "TRADE_FINISHED";
}

module.exports = {
  getSdk,
  createPagePayForm,
  queryTrade,
  refundTrade,
  verifyNotify,
  generateOutTradeNo,
  formatAmount,
  isPaidTradeStatus,
};
