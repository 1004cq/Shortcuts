# 支付宝电脑网站支付（Node.js + Express）

支持 **沙箱 / 生产** 一键切换的完整集成示例。

```text
alipay-website-payment/
├── config/
│   └── alipay.js            # 配置（读 .env，沙箱/生产网关）
├── controllers/
│   └── payment.js           # 下单 / 通知 / 回跳 / 查单 / 退款
├── routes/
│   └── payment.js
├── utils/
│   ├── alipaySDK.js         # alipay.trade.page.pay Form、验签、查单、退款
│   └── logger.js
├── public/
│   ├── index.html           # 商品 / 下单页
│   └── success.html         # 支付成功页
├── .env.example             # 密钥模板（复制为 .env）
├── .gitignore
├── server.js
├── package.json
└── README.md
```

## 快速开始

```bash
cd alipay-website-payment
npm install
cp .env.example .env
```

编辑 `.env`，填入你的密钥：

```env
ALIPAY_APP_ID=你的APPID
ALIPAY_PRIVATE_KEY=你的应用私钥
ALIPAY_PUBLIC_KEY=支付宝公钥
ALIPAY_KEY_TYPE=PKCS8

# 沙箱调试
ALIPAY_SANDBOX=true

# 上线生产时改为
# ALIPAY_SANDBOX=false
# APP_URL=https://你的域名
```

```bash
npm start
# 打开 http://localhost:4000
```

> **安全**：真实密钥只放 `.env`，该文件已在 `.gitignore` 中，不要提交到 Git。  
> 你消息里的密钥仍是占位符；把真实 APPID / 私钥 / 支付宝公钥粘贴进 `.env` 即可。

## 支付流程

1. **创建订单**  
   `POST /api/payment/create` → 调用 `alipay.trade.page.pay` → 返回 **Form HTML**，浏览器自动跳转支付宝。

2. **支付成功**
   - **同步 `return_url`**：`/api/payment/return` → 跳转 `success.html` 展示结果  
   - **异步 `notify_url`**：`/api/payment/notify` → **验签** → 校验 `app_id`/金额 → 更新订单 → 返回纯文本 `success`  
   - 以异步通知为准

3. **额外能力**
   - 查单：`GET /api/payment/query?outTradeNo=`
   - 退款：`POST /api/payment/refund` `{ "outTradeNo": "...", "refundAmount": 0.01 }`
   - 结构化日志、统一错误处理

4. **安全**
   - 密钥仅环境变量
   - 订单号：`MV` + 时间戳 + `crypto.randomBytes`（唯一）
   - `notify_id` 防重放；已支付订单幂等返回 `success`

## 沙箱 vs 生产

| 变量 | 沙箱 | 生产 |
|------|------|------|
| `ALIPAY_SANDBOX` | `true` | `false` |
| 网关 | `openapi-sandbox.dl.alipaydev.com` | `openapi.alipay.com` |
| 密钥 | 沙箱应用密钥 | 正式应用密钥 |
| `APP_URL` | 内网穿透公网地址 | 正式 HTTPS 域名 |

沙箱买家账号在开放平台「沙箱账号」中查看。

## 本地调试异步通知

支付宝服务器必须能访问 `notify_url`。本地请用 frp / ngrok / cpolar 等穿透，并设置：

```env
APP_URL=https://xxxx.ngrok-free.app
```

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 环境与配置状态 |
| GET | `/api/payment/products` | 商品列表 |
| POST | `/api/payment/create` | 下单；默认 Form HTML，`?format=json` 返回 `{ payForm }` |
| POST | `/api/payment/notify` | 异步通知 |
| GET | `/api/payment/return` | 同步回跳 |
| GET | `/api/payment/query` | 订单查询 |
| POST | `/api/payment/refund` | 退款（可选） |

## 与 MediaVault

主站 MediaVault（Next.js）已内置同等支付能力。本目录是独立可运行的 Express 演示，方便单独联调支付宝。
