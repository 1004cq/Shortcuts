/**
 * 支付宝配置 — 仅从环境变量读取，禁止把真实密钥写进代码仓库
 *
 * 沙箱 / 生产切换：ALIPAY_SANDBOX=true|false
 */
function normalizePem(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

function appBaseUrl() {
  return (process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`).replace(
    /\/$/,
    ""
  );
}

const GATEWAY_PROD = "https://openapi.alipay.com/gateway.do";
const GATEWAY_SANDBOX = "https://openapi-sandbox.dl.alipaydev.com/gateway.do";

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

  /** 是否沙箱环境 */
  get sandbox() {
    const v = String(process.env.ALIPAY_SANDBOX || "true").toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  },

  get envName() {
    return this.sandbox ? "sandbox" : "production";
  },

  get gateway() {
    if (process.env.ALIPAY_GATEWAY?.trim()) {
      return process.env.ALIPAY_GATEWAY.trim();
    }
    return this.sandbox ? GATEWAY_SANDBOX : GATEWAY_PROD;
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

  /** 启动时打印（不输出私钥内容） */
  summary() {
    return {
      env: this.envName,
      sandbox: this.sandbox,
      appId: this.appId ? `${this.appId.slice(0, 6)}****` : "(empty)",
      keyType: this.keyType,
      gateway: this.gateway,
      notifyUrl: this.notifyUrl,
      returnUrl: this.returnUrl,
      configured: this.isConfigured(),
    };
  },
};

module.exports = config;
