/**
 * 支付宝配置模块
 * ------------------------------------------------------------
 * 所有敏感信息只从环境变量 /.env 读取，禁止硬编码私钥。
 *
 * 沙箱 / 生产切换：
 *   1. 直接设置 GATEWAY（优先级最高）
 *      - 沙箱：https://openapi-sandbox.dl.alipaydev.com/gateway.do
 *      - 生产：https://openapi.alipay.com/gateway.do
 *   2. 或设置 ALIPAY_SANDBOX=true|false（未设置 GATEWAY 时生效）
 */

/** 把 .env 里用 \n 写成一行的 PEM 还原成多行 */
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
  /** 应用 APPID */
  get appId() {
    // 兼容旧变量名 ALIPAY_APP_ID
    return (process.env.APP_ID || process.env.ALIPAY_APP_ID || "").trim();
  },

  /** 应用私钥（商户私钥） */
  get privateKey() {
    return normalizePem(process.env.PRIVATE_KEY || process.env.ALIPAY_PRIVATE_KEY);
  },

  /** 支付宝公钥 */
  get alipayPublicKey() {
    return normalizePem(process.env.ALIPAY_PUBLIC_KEY);
  },

  /** PKCS8 / PKCS1 */
  get keyType() {
    const t = String(process.env.KEY_TYPE || process.env.ALIPAY_KEY_TYPE || "PKCS8").toUpperCase();
    return t === "PKCS1" ? "PKCS1" : "PKCS8";
  },

  /**
   * 是否沙箱
   * 若显式配置了 GATEWAY，则以网关域名判断；否则读 ALIPAY_SANDBOX
   */
  get sandbox() {
    if (process.env.GATEWAY?.trim()) {
      return process.env.GATEWAY.includes("alipaydev.com") || process.env.GATEWAY.includes("sandbox");
    }
    const v = String(process.env.ALIPAY_SANDBOX || "true").toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  },

  get envName() {
    return this.sandbox ? "sandbox" : "production";
  },

  /** 网关地址（沙箱 / 生产） */
  get gateway() {
    if (process.env.GATEWAY?.trim()) return process.env.GATEWAY.trim();
    return this.sandbox ? GATEWAY_SANDBOX : GATEWAY_PROD;
  },

  /** 异步通知 URL */
  get notifyUrl() {
    return process.env.NOTIFY_URL || process.env.ALIPAY_NOTIFY_URL || `${appBaseUrl()}/notify`;
  },

  /** 同步跳转 URL */
  get returnUrl() {
    return process.env.RETURN_URL || process.env.ALIPAY_RETURN_URL || `${appBaseUrl()}/return`;
  },

  get baseUrl() {
    return appBaseUrl();
  },

  /** 演示商品（可在 .env 配置） */
  get product() {
    return {
      title: process.env.PRODUCT_TITLE || "测试商品",
      amount: Number(process.env.PRODUCT_AMOUNT || 0.01),
      desc: process.env.PRODUCT_DESC || "支付宝电脑网站支付演示",
    };
  },

  isConfigured() {
    return Boolean(this.appId && this.privateKey && this.alipayPublicKey);
  },

  /** 启动日志用摘要（不打印私钥） */
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
      product: this.product,
    };
  },
};

module.exports = config;
