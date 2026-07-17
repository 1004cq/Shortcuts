/**
 * 支付宝电脑网站支付 — Express 入口
 * ------------------------------------------------------------
 * 启动：
 *   cp .env.example .env   # 填入 APP_ID / PRIVATE_KEY / ALIPAY_PUBLIC_KEY
 *   npm install && npm start
 *
 * 沙箱：GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
 * 生产：GATEWAY=https://openapi.alipay.com/gateway.do
 */
require("dotenv").config();

const path = require("path");
const express = require("express");
const paymentRoutes = require("./routes/payment");
const config = require("./config/alipay");
const logger = require("./utils/logger");

const app = express();
const PORT = Number(process.env.PORT || 4000);

// 支付宝异步通知 Content-Type: application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 静态前端：index.html / success.html
app.use(express.static(path.join(__dirname, "public")));

// 健康检查
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...config.summary() });
});

// 挂载支付路由（/create-payment、/return、/notify 等）
app.use(paymentRoutes);

// 统一错误处理
app.use((err, _req, res, _next) => {
  logger.error("server", "未捕获异常", { err: err.message, stack: err.stack });
  res.status(500).json({ error: "服务器错误" });
});

app.listen(PORT, () => {
  const s = config.summary();
  console.log("========================================");
  console.log(" 支付宝电脑网站支付");
  console.log("========================================");
  console.log(` 本地地址   : http://localhost:${PORT}`);
  console.log(` 运行环境   : ${s.env}`);
  console.log(` 密钥已配置 : ${s.configured}`);
  console.log(` APP_ID     : ${s.appId}`);
  console.log(` GATEWAY    : ${s.gateway}`);
  console.log(` NOTIFY_URL : ${s.notifyUrl}`);
  console.log(` RETURN_URL : ${s.returnUrl}`);
  console.log(` 演示商品   : ${s.product.title} ¥${s.product.amount}`);
  console.log("========================================");
  if (!s.configured) {
    console.log(" ⚠ 请复制 .env.example 为 .env 并填入密钥");
  }
});
