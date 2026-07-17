/**
 * 支付相关路由
 * ------------------------------------------------------------
 * POST /create-payment  创建支付（返回 Form HTML）
 * GET  /return          同步回跳
 * POST /notify          异步通知
 * GET  /api/product     商品配置
 * GET  /api/order       查询订单
 */
const express = require("express");
const controller = require("../controllers/payment");

const router = express.Router();

// —— 核心三个接口（按需求命名）——
router.post("/create-payment", controller.createPayment);
router.get("/return", controller.returnPayment);
router.post("/notify", controller.notifyPayment);

// —— 辅助接口 ——
router.get("/api/product", controller.getProduct);
router.get("/api/order", controller.queryOrder);
router.get("/api/order/:outTradeNo", controller.queryOrder);

module.exports = router;
