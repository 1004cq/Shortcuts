/**
 * 支付宝电脑网站支付 — Express 入口
 *
 *   npm install
 *   cp .env.example .env   # 填入密钥
 *   npm start
 */
require("dotenv").config();

const path = require("path");
const express = require("express");
const paymentRoutes = require("./routes/payment");
const config = require("./config/alipay");

const app = express();
const PORT = Number(process.env.PORT || 4000);

// 支付宝异步通知为 application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    alipayConfigured: config.isConfigured(),
    notifyUrl: config.notifyUrl,
    returnUrl: config.returnUrl,
  });
});

app.use("/api/payment", paymentRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "服务器错误" });
});

app.listen(PORT, () => {
  console.log(`Alipay website payment listening on http://localhost:${PORT}`);
  console.log(`  configured : ${config.isConfigured()}`);
  console.log(`  notify_url : ${config.notifyUrl}`);
  console.log(`  return_url : ${config.returnUrl}`);
});
