/**
 * 支付宝 SDK 封装：
 * - page.pay Form HTML 自动跳转
 * - 验签 / 查单 / 退款
 */
const crypto = require("node:crypto");
const { Blob: NodeBlob, File: NodeFile } = require("node:buffer");
const { AlipaySdk } = require("alipay-sdk");
const config = require("../config/alipay");
const logger = require("./logger");

// Node 18 兼容：部分依赖需要全局 File / Blob
if (typeof globalThis.File === "undefined" && typeof NodeFile !== "undefined") {
  globalThis.File = NodeFile;
}
if (typeof globalThis.Blob === "undefined" && typeof NodeBlob !== "undefined") {
  globalThis.Blob = NodeBlob;
}

let cachedSdk = null;

function getSdk() {
  if (!config.isConfigured()) {
    throw new Error("支付宝未配置：请在 .env 中设置 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY");
  }
  if (cachedSdk) return cachedSdk;

  cachedSdk = new AlipaySdk({
    appId: config.appId,
    privateKey: config.privateKey,
    alipayPublicKey: config.alipayPublicKey,
    keyType: config.keyType,
    signType: "RSA2",
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

function isMobileUserAgent(ua) {
  if (!ua) return false;
  return /Android|iPhone|iPod|iPad|Mobile|MicroMessenger|AlipayClient/i.test(ua);
}

/**
 * 唯一商户订单号：前缀 + 毫秒时间 + 8 位随机 hex
 * 长度远小于支付宝 64 字符限制
 */
function generateOutTradeNo(prefix = "ORD") {
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}${Date.now()}${rand}`;
}

/**
 * 调用 alipay.trade.page.pay（或手机 wap.pay）
 * 返回可自动提交的 Form HTML（POST）
 */
function createPayForm({ outTradeNo, subject, totalAmount, body, mobile = false }) {
  const sdk = getSdk();
  // 规范要求：电脑网站支付使用 page.pay + Form HTML
  // 手机浏览器使用 wap.pay（同样返回 Form HTML）
  const method = mobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
  const productCode = mobile ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY";

  const html = sdk.pageExecute(method, "POST", {
    notifyUrl: config.notifyUrl,
    returnUrl: config.returnUrl,
    bizContent: {
      out_trade_no: outTradeNo,
      product_code: productCode,
      total_amount: formatAmount(totalAmount),
      subject,
      body: body || subject,
    },
  });

  logger.info("alipaySDK", "createPayForm", {
    method,
    outTradeNo,
    amount: formatAmount(totalAmount),
  });

  return html;
}

/** @deprecated 使用 createPayForm；保留 GET URL 兼容 */
function createPayUrl(params) {
  const sdk = getSdk();
  const method = params.mobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
  const productCode = params.mobile ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY";
  return sdk.pageExecute(method, "GET", {
    notifyUrl: config.notifyUrl,
    returnUrl: config.returnUrl,
    bizContent: {
      out_trade_no: params.outTradeNo,
      product_code: productCode,
      total_amount: formatAmount(params.totalAmount),
      subject: params.subject,
      body: params.body || params.subject,
    },
  });
}

async function queryTrade(outTradeNo) {
  const sdk = getSdk();
  logger.info("alipaySDK", "queryTrade", { outTradeNo });
  return sdk.exec("alipay.trade.query", {
    bizContent: { out_trade_no: outTradeNo },
  });
}

/**
 * 退款（可选）
 * @see https://opendocs.alipay.com/open/028r54
 */
async function refundTrade({ outTradeNo, refundAmount, refundReason, outRequestNo }) {
  const sdk = getSdk();
  const requestNo = outRequestNo || generateOutTradeNo("RF");
  logger.info("alipaySDK", "refundTrade", { outTradeNo, refundAmount, requestNo });
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
    logger.warn("alipaySDK", "checkNotifySignV2 failed", { err: String(err) });
  }
  try {
    return sdk.checkNotifySign(payload);
  } catch (err) {
    logger.warn("alipaySDK", "checkNotifySign failed", { err: String(err) });
    return false;
  }
}

function isPaidTradeStatus(status) {
  return status === "TRADE_SUCCESS" || status === "TRADE_FINISHED";
}

module.exports = {
  getSdk,
  createPayForm,
  createPayUrl,
  queryTrade,
  refundTrade,
  verifyNotify,
  generateOutTradeNo,
  formatAmount,
  isMobileUserAgent,
  isPaidTradeStatus,
};
