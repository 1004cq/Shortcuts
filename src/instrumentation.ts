/**
 * Runs once when the Next.js Node server boots.
 * Ensures File/Blob exist before any route loads alipay-sdk.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/node-file-polyfill");
  }
}
