/**
 * 支付相关路由
 */
const express = require("express");
const controller = require("../controllers/payment");

const router = express.Router();

router.get("/products", controller.listProducts);
router.post("/create", controller.createPayment);
router.post("/notify", controller.notifyPayment);
router.get("/return", controller.returnPayment);
router.get("/query", controller.queryPayment);

module.exports = router;
