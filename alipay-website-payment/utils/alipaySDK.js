/**
 * 支付宝 SDK 封装
 * - alipay.trade.page.pay → Form HTML 自动跳转（电脑网站支付）
 * - 验签 / 查单 / 退款
 * - 支持沙箱 / 生产（由 config.gateway 决定）
 */
const crypto = require("node:crypto");
const { Blob: NodeBlob, File: NodeFile } = require("node:buffer");
const { AlipaySdk } = require("alipay-sdk");
const config = require("../config/alipay");
const logger = require("./logger");

// Node 18 兼容
if (typeof globalThis.File === "undefined" && typeof NodeFile !== "undefined") {
  globalThis.File = NodeFile;
}
if (typeof globalThis.Blob === "undefined" && typeof NodeBlob !== "undefined") {
  globalThis.Blob = NodeBlob;
}

let cachedSdk = null;
let cachedKey = "";

function cacheKey() {
  return [config.appId, config.gateway, config.keyType, config.sandbox ? "1" : "0"].join("|");
}

function getSdk() {
  if (!config.isConfigured()) {
    throw new Error(
      "支付宝未配置：请在 .env 填写 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY"
    );
  }

  const key = cacheKey();
  if (cachedSdk && cachedKey === key) return cachedSdk;

  cachedSdk = new AlipaySdk({
    appId: config.appId,
    privateKey: config.privateKey,
    alipayPublicKey: config.alipayPublicKey,
    keyType: config.keyType,
    signType: "RSA2",
    gateway: config.gateway,
  });
  cachedKey = key;
  logger.info("alipaySDK", "sdk initialized", {
    env: config.envName,
    gateway: config.gateway,
  });
  return cachedSdk;
}

function formatAmount(yuan) {
  const n = Number(yuan);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`无效金额: ${yuan}`);
  }
  return n.toFixed(2);
}

function generateOutTradeNo(prefix = "ORD") {
  return `${prefix}${Date.now()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * 电脑网站支付：alipay.trade.page.pay
 * 返回自动提交的 Form HTML（POST）
 */
function createPagePayForm({ outTradeNo, subject, totalAmount, body }) {
  const sdk = getSdk();
  const html = sdk.pageExecute("alipay.trade.page.pay", "POST", {
    notifyUrl: config.notifyUrl,
    returnUrl: config.returnUrl,
    bizContent: {
      out_trade_no: outTradeNo,
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: formatAmount(totalAmount),
      subject,
      body: body || subject,
    },
  });

  logger.info("alipaySDK", "page.pay form created", {
    env: config.envName,
    outTradeNo,
    amount: formatAmount(totalAmount),
  });
  return html;
}

async function queryTrade(outTradeNo) {
  const sdk = getSdk();
  logger.info("alipaySDK", "trade.query", { outTradeNo });
  return sdk.exec("alipay.trade.query", {
    bizContent: { out_trade_no: outTradeNo },
  });
}

async function refundTrade({ outTradeNo, refundAmount, refundReason, outRequestNo }) {
  const sdk = getSdk();
  const requestNo = outRequestNo || generateOutTradeNo("RF");
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

function verifyNotify(payload) {
  const sdk = getSdk();
  try {
    if (sdk.checkNotifySignV2(payload)) return true;
  } catch (err) {
    logger.warn("alipaySDK", "checkNotifySignV2 error", { err: String(err.message || err) });
  }
  try {
    return sdk.checkNotifySign(payload);
  } catch (err) {
    logger.warn("alipaySDK", "checkNotifySign error", { err: String(err.message || err) });
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
