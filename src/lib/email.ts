import nodemailer from "nodemailer";
import { getAppUrl } from "@/lib/utils";

/**
 * Email helper — uses SMTP when configured; otherwise logs the link (dev mode).
 */
function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${getAppUrl()}/verify?token=${encodeURIComponent(token)}`;
  const subject = "MediaVault — 验证你的邮箱";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>欢迎加入 MediaVault</h2>
      <p>请点击下方链接完成邮箱验证（24 小时内有效）：</p>
      <p><a href="${verifyUrl}" style="color:#3b82f6">${verifyUrl}</a></p>
      <p style="color:#64748b;font-size:12px">如果这不是你发起的注册，请忽略本邮件。</p>
    </div>
  `;

  const transport = createTransport();
  if (!transport) {
    console.info("[email:dev] Verification link for", email, verifyUrl);
    return { dev: true, verifyUrl };
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || "MediaVault <noreply@mediavault.local>",
    to: email,
    subject,
    html,
  });

  return { dev: false };
}
