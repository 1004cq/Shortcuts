/**
 * 支付宝 SDK 封装：下单、验签、查单
 */
const { Blob: NodeBlob, File: NodeFile } = require("node:buffer");
const { AlipaySdk } = require("alipay-sdk");
const config = require("../config/alipay");

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
  return Number(yuan).toFixed(2);
}

function isMobileUserAgent(ua) {
  if (!ua) return false;
  return /Android|iPhone|iPod|iPad|Mobile|MicroMessenger|AlipayClient/i.test(ua);
}

/**
 * 生成支付跳转 URL（GET）
 * PC: alipay.trade.page.pay
 * 手机: alipay.trade.wap.pay
 */
function createPayUrl({ outTradeNo, subject, totalAmount, body, mobile = false }) {
  const sdk = getSdk();
  const method = mobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
  const productCode = mobile ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY";

  return sdk.pageExecute(method, "GET", {
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
}

async function queryTrade(outTradeNo) {
  const sdk = getSdk();
  return sdk.exec("alipay.trade.query", {
    bizContent: { out_trade_no: outTradeNo },
  });
}

function verifyNotify(payload) {
  const sdk = getSdk();
  try {
    if (sdk.checkNotifySignV2(payload)) return true;
  } catch {
    // ignore
  }
  try {
    return sdk.checkNotifySign(payload);
  } catch {
    return false;
  }
}

function generateOutTradeNo(prefix = "ORD") {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}${ts}${rand}`;
}

module.exports = {
  getSdk,
  createPayUrl,
  queryTrade,
  verifyNotify,
  generateOutTradeNo,
  formatAmount,
  isMobileUserAgent,
};
