/**
 * MediaVault Alipay helpers (Next.js).
 * Standalone Express demo: alipay-website-payment/
 *
 * Flow:
 * 1. createAlipayPayForm → alipay.trade.page.pay Form HTML
 * 2. return_url show success; notify_url verify + fulfill + "success"
 * 3. query / refund helpers
 *
 * Keys: prefer ALIPAY_*_KEY_PATH PEM files (systemd-safe).
 * Inline ALIPAY_*_KEY also supported; normalizePem repairs \n mangling.
 */
import fs from "node:fs";
import "@/lib/node-file-polyfill";
import { AlipaySdk } from "alipay-sdk";

/**
 * Normalize PEM from env.
 * systemd EnvironmentFile often turns `\n` into a literal `n`, producing:
 *   -----BEGIN PRIVATE KEY-----nMIIE...n-----END PRIVATE KEY-----
 */
function normalizePem(raw: string | undefined): string {
  if (!raw) return "";
  let s = String(raw).trim();
  // Strip wrapping quotes from EnvironmentFile
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  s = s.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  // Repair systemd-mangled header/footer newlines
  s = s.replace(/(-----BEGIN [^-]+-----)\s*n(?=[A-Za-z0-9+/=])/g, "$1\n");
  s = s.replace(/([A-Za-z0-9+/=])n(-----END [^-]+-----)/g, "$1\n$2");
  // If still one-line PEM, insert newlines around headers
  if (!s.includes("\n") && s.includes("-----BEGIN")) {
    s = s
      .replace(/(-----BEGIN [^-]+-----)/, "$1\n")
      .replace(/(-----END [^-]+-----)/, "\n$1");
  }
  return s.trim();
}

function readPem(envValue: string | undefined, pathEnv: string | undefined): string {
  const filePath = pathEnv?.trim();
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8").trim();
  }
  return normalizePem(envValue);
}

function loadPrivateKey(): string {
  return readPem(process.env.ALIPAY_PRIVATE_KEY, process.env.ALIPAY_PRIVATE_KEY_PATH);
}

function loadPublicKey(): string {
  return readPem(process.env.ALIPAY_PUBLIC_KEY, process.env.ALIPAY_PUBLIC_KEY_PATH);
}

function appBaseUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

export function isAlipayConfigured(): boolean {
  return Boolean(
    process.env.ALIPAY_APP_ID?.trim() && loadPrivateKey() && loadPublicKey()
  );
}

/** When Alipay is not configured, allow demo checkout unless explicitly disabled. */
export function isDemoCheckoutAllowed(): boolean {
  if (isAlipayConfigured()) return false;
  const flag = (process.env.PAYMENT_DEMO_MODE || "true").toLowerCase();
  return flag !== "false" && flag !== "0";
}

let cachedSdk: AlipaySdk | null = null;

export function getAlipaySdk(): AlipaySdk {
  if (!isAlipayConfigured()) {
    throw new Error(
      "支付宝未配置：请设置 ALIPAY_APP_ID 与密钥（ALIPAY_*_KEY 或 ALIPAY_*_KEY_PATH）"
    );
  }
  if (cachedSdk) return cachedSdk;

  const keyType =
    (process.env.ALIPAY_KEY_TYPE || "PKCS8").toUpperCase() === "PKCS1" ? "PKCS1" : "PKCS8";

  const config: ConstructorParameters<typeof AlipaySdk>[0] = {
    appId: process.env.ALIPAY_APP_ID!.trim(),
    privateKey: loadPrivateKey(),
    alipayPublicKey: loadPublicKey(),
    keyType,
    signType: "RSA2",
  };

  if (process.env.ALIPAY_GATEWAY?.trim()) {
    config.gateway = process.env.ALIPAY_GATEWAY.trim();
  } else if (process.env.ALIPAY_SANDBOX === "true") {
    config.gateway = "https://openapi-sandbox.dl.alipaydev.com/gateway.do";
  }

  cachedSdk = new AlipaySdk(config);
  return cachedSdk;
}

export function alipayNotifyUrl(): string {
  return process.env.ALIPAY_NOTIFY_URL || `${appBaseUrl()}/api/payments/alipay/notify`;
}

export function alipayReturnUrl(): string {
  return process.env.ALIPAY_RETURN_URL || `${appBaseUrl()}/api/payments/alipay/return`;
}

export function isMobileUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /Android|iPhone|iPod|iPad|Mobile|MicroMessenger|AlipayClient/i.test(ua);
}

export function formatAlipayAmount(yuan: number): string {
  if (!Number.isFinite(yuan) || yuan <= 0) {
    throw new Error(`无效金额: ${yuan}`);
  }
  return yuan.toFixed(2);
}

export function isPaidTradeStatus(status: string | undefined | null): boolean {
  return status === "TRADE_SUCCESS" || status === "TRADE_FINISHED";
}

/**
 * alipay.trade.page.pay / wap.pay — returns auto-submit Form HTML (POST).
 */
export function createAlipayPayForm(params: {
  outTradeNo: string;
  subject: string;
  totalAmount: number;
  body?: string;
  mobile?: boolean;
}): string {
  const sdk = getAlipaySdk();
  const amount = formatAlipayAmount(params.totalAmount);
  const method = params.mobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
  const productCode = params.mobile ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY";

  const html = sdk.pageExecute(method, "POST", {
    notifyUrl: alipayNotifyUrl(),
    returnUrl: alipayReturnUrl(),
    bizContent: {
      out_trade_no: params.outTradeNo,
      product_code: productCode,
      total_amount: amount,
      subject: params.subject,
      body: params.body || params.subject,
    },
  });

  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      tag: "alipay",
      message: "createPayForm",
      method,
      outTradeNo: params.outTradeNo,
      amount,
    })
  );

  return html;
}

/** GET pay URL (legacy); prefer createAlipayPayForm */
export function createAlipayPayUrl(params: {
  outTradeNo: string;
  subject: string;
  totalAmount: number;
  body?: string;
  mobile?: boolean;
}): string {
  const sdk = getAlipaySdk();
  const amount = formatAlipayAmount(params.totalAmount);
  const method = params.mobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
  const productCode = params.mobile ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY";

  return sdk.pageExecute(method, "GET", {
    notifyUrl: alipayNotifyUrl(),
    returnUrl: alipayReturnUrl(),
    bizContent: {
      out_trade_no: params.outTradeNo,
      product_code: productCode,
      total_amount: amount,
      subject: params.subject,
      body: params.body || params.subject,
    },
  });
}

export async function queryAlipayTrade(outTradeNo: string) {
  const sdk = getAlipaySdk();
  return sdk.exec("alipay.trade.query", {
    bizContent: {
      out_trade_no: outTradeNo,
    },
  });
}

export async function refundAlipayTrade(opts: {
  outTradeNo: string;
  refundAmount: number;
  refundReason?: string;
  outRequestNo: string;
}) {
  const sdk = getAlipaySdk();
  return sdk.exec("alipay.trade.refund", {
    bizContent: {
      out_trade_no: opts.outTradeNo,
      refund_amount: formatAlipayAmount(opts.refundAmount),
      refund_reason: opts.refundReason || "会员退款",
      out_request_no: opts.outRequestNo,
    },
  });
}

export function verifyAlipayNotify(payload: Record<string, string>): boolean {
  const sdk = getAlipaySdk();
  try {
    if (sdk.checkNotifySignV2(payload)) return true;
  } catch {
    // fall through
  }
  try {
    return sdk.checkNotifySign(payload);
  } catch {
    return false;
  }
}

export function parseFormBody(raw: string): Record<string, string> {
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
