import { AlipaySdk } from "alipay-sdk";

function normalizePem(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

function appBaseUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

export function isAlipayConfigured(): boolean {
  return Boolean(
    process.env.ALIPAY_APP_ID?.trim() &&
      normalizePem(process.env.ALIPAY_PRIVATE_KEY) &&
      normalizePem(process.env.ALIPAY_PUBLIC_KEY)
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
    throw new Error("支付宝未配置：请设置 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY");
  }
  if (cachedSdk) return cachedSdk;

  const keyType =
    (process.env.ALIPAY_KEY_TYPE || "PKCS8").toUpperCase() === "PKCS1" ? "PKCS1" : "PKCS8";

  const config: ConstructorParameters<typeof AlipaySdk>[0] = {
    appId: process.env.ALIPAY_APP_ID!.trim(),
    privateKey: normalizePem(process.env.ALIPAY_PRIVATE_KEY),
    alipayPublicKey: normalizePem(process.env.ALIPAY_PUBLIC_KEY),
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
  // Sync return hits API first (query + fulfill), then redirects to /pricing/result
  return process.env.ALIPAY_RETURN_URL || `${appBaseUrl()}/api/payments/alipay/return`;
}

export function isMobileUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /Android|iPhone|iPod|iPad|Mobile|MicroMessenger|AlipayClient/i.test(ua);
}

export function formatAlipayAmount(yuan: number): string {
  return yuan.toFixed(2);
}

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

export function verifyAlipayNotify(payload: Record<string, string>): boolean {
  const sdk = getAlipaySdk();
  // Prefer V2 (no URL-decode) which matches most Node form parsers
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
