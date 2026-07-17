/**
 * 支付宝配置（从环境变量读取，切勿把真实密钥写进代码）
 */
function normalizePem(raw) {
  if (!raw) return "";
  return String(raw).replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

function appBaseUrl() {
  return (process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`).replace(
    /\/$/,
    ""
  );
}

const config = {
  get appId() {
    return (process.env.ALIPAY_APP_ID || "").trim();
  },
  get privateKey() {
    return normalizePem(process.env.ALIPAY_PRIVATE_KEY);
  },
  get alipayPublicKey() {
    return normalizePem(process.env.ALIPAY_PUBLIC_KEY);
  },
  get keyType() {
    return String(process.env.ALIPAY_KEY_TYPE || "PKCS8").toUpperCase() === "PKCS1"
      ? "PKCS1"
      : "PKCS8";
  },
  get sandbox() {
    return String(process.env.ALIPAY_SANDBOX || "").toLowerCase() === "true";
  },
  get gateway() {
    if (process.env.ALIPAY_GATEWAY?.trim()) return process.env.ALIPAY_GATEWAY.trim();
    if (this.sandbox) return "https://openapi-sandbox.dl.alipaydev.com/gateway.do";
    return "https://openapi.alipay.com/gateway.do";
  },
  get notifyUrl() {
    return process.env.ALIPAY_NOTIFY_URL || `${appBaseUrl()}/api/payment/notify`;
  },
  get returnUrl() {
    return process.env.ALIPAY_RETURN_URL || `${appBaseUrl()}/api/payment/return`;
  },
  get baseUrl() {
    return appBaseUrl();
  },
  isConfigured() {
    return Boolean(this.appId && this.privateKey && this.alipayPublicKey);
  },
};

module.exports = config;
