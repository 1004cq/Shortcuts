/**
 * 支付宝电脑网站支付 — Express 入口
 *
 * 启动：
 *   cd alipay-website-payment
 *   cp .env.example .env   # 填入 APPID / 应用私钥 / 支付宝公钥
 *   npm install && npm start
 *
 * 沙箱：ALIPAY_SANDBOX=true
 * 生产：ALIPAY_SANDBOX=false
 */
require("dotenv").config();

const path = require("path");
const express = require("express");
const paymentRoutes = require("./routes/payment");
const config = require("./config/alipay");
const logger = require("./utils/logger");

const app = express();
const PORT = Number(process.env.PORT || 4000);

// 支付宝异步通知为 application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    ...config.summary(),
  });
});

app.use("/api/payment", paymentRoutes);

// 统一错误处理
app.use((err, _req, res, _next) => {
  logger.error("server", "unhandled", { err: err.message, stack: err.stack });
  res.status(500).json({ error: "服务器错误" });
});

app.listen(PORT, () => {
  const s = config.summary();
  console.log("========================================");
  console.log(" 支付宝电脑网站支付 Demo");
  console.log("========================================");
  console.log(` URL        : http://localhost:${PORT}`);
  console.log(` 环境       : ${s.env} (ALIPAY_SANDBOX=${config.sandbox})`);
  console.log(` 已配置密钥 : ${s.configured}`);
  console.log(` APPID      : ${s.appId}`);
  console.log(` 网关       : ${s.gateway}`);
  console.log(` notify_url : ${s.notifyUrl}`);
  console.log(` return_url : ${s.returnUrl}`);
  console.log("========================================");
  if (!s.configured) {
    console.log(" ⚠ 请复制 .env.example → .env 并填入密钥后再测试支付");
  }
});
