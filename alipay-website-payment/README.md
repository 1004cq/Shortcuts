# 支付宝电脑网站支付示例

```text
alipay-website-payment/
├── config/alipay.js          # 配置（仅读环境变量）
├── controllers/payment.js    # 下单 / 通知 / 回跳 / 查单 / 退款
├── routes/payment.js
├── utils/
│   ├── alipaySDK.js          # page.pay Form、验签、查单、退款
│   └── logger.js
├── public/
│   ├── index.html
│   └── success.html
├── .env.example
├── server.js
└── package.json
```

## 流程（与开放平台文档一致）

1. **创建支付订单**  
   后端调用 `alipay.trade.page.pay`（手机端 `wap.pay`），`pageExecute(..., 'POST')` 生成 **Form HTML**，浏览器自动提交跳转支付宝。

2. **支付成功**
   - **同步 `return_url`** → `/api/payment/return` → 跳转 `success.html` 展示结果  
   - **异步 `notify_url`** → `/api/payment/notify`：**验签** → 校验 `app_id` / 金额 → **幂等更新订单** → 返回纯文本 `success`  
   - 以异步通知为准；同步回跳仅用于展示

3. **额外**
   - 订单查询：`GET /api/payment/query?outTradeNo=`
   - 退款（可选）：`POST /api/payment/refund`
   - 结构化日志：`utils/logger.js`
   - 统一错误处理与 HTTP 状态码

4. **安全**
   - 密钥只放 `.env`（已 gitignore）
   - 订单号：`MV` + 时间戳 + `crypto.randomBytes`（唯一）
   - 防重放：记录 `notify_id`，重复通知直接 `success` 且不重复改单
   - 已支付订单再次通知：幂等返回 `success`

## 快速开始

```bash
cd alipay-website-payment
npm install
cp .env.example .env   # 填入 APPID / 应用私钥 / 支付宝公钥
npm start              # http://localhost:4000
```

本地联调异步通知需公网 HTTPS（或内网穿透），并把 `APP_URL` / `ALIPAY_NOTIFY_URL` 指到可访问地址。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/payment/create` | 默认返回 Form HTML；`?format=json` 返回 `{ payForm, outTradeNo }` |
| POST | `/api/payment/notify` | 异步通知（验签 + 更新订单） |
| GET | `/api/payment/return` | 同步回跳 → 成功页 |
| GET | `/api/payment/query` | 查本地订单 + `trade.query` |
| POST | `/api/payment/refund` | `{ outTradeNo, refundAmount?, reason? }` |

## MediaVault

主站已实现同等流程（`src/lib/alipay.ts`）。生产把 `ALIPAY_*` 配到 MediaVault 环境变量即可，不必长期运行本演示服务。
